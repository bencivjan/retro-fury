(function() {
    'use strict';

    const G = window.__GAME_INTERNALS;
    const inp = window.__INPUT;
    if (!G || !inp) { console.error('[BOT] No instrumentation!'); return; }

    console.log('[BOT] Starting v4 (in-loop, 1min limit, kill metric)...');

    // ---- Config ----
    const TIME_LIMIT = 60; // seconds per run

    // ---- State ----
    let runCount = 0;
    let deathLog = [];
    let bestRun = { level: 0, kills: 0, time: 0 };
    let won = false;
    let deathHandled = false;
    let lcHandled = false;
    let combatCycle = 0;
    let prevKeys = new Set(); // For edge detection

    // Stuck detection
    let stuckHistory = []; // [{x,y,t}]
    const STUCK_CHECK = 1.5; // seconds
    const STUCK_DIST = 0.4;

    // Path cache
    let path = null;
    let pathKey = '';
    let pathTime = -999;
    let pathIdx = 0;

    // ---- Helpers ----
    function d2(x1,y1,x2,y2) { return Math.sqrt((x2-x1)**2+(y2-y1)**2); }
    function aTo(x1,y1,x2,y2) { return Math.atan2(y2-y1,x2-x1); }
    function aN(a) { while(a>Math.PI) a-=2*Math.PI; while(a<-Math.PI) a+=2*Math.PI; return a; }
    function aD(f,t) { return aN(t-f); }

    // ---- BFS ----
    function bfs(grid, doors, player, sx, sy, gx, gy) {
        const w=grid[0].length, h=grid.length;
        const sX=Math.floor(sx), sY=Math.floor(sy);
        const gX=Math.floor(gx), gY=Math.floor(gy);
        if (sX===gX && sY===gY) return [{x:gx,y:gy}];

        // Block locked doors the player can't open
        const blocked = new Set();
        for (const d of doors) {
            if (d.lockColor && d.isBlocking() && !player.keycards.has(d.lockColor)) {
                blocked.add(d.y*w+d.x);
            }
        }

        const vis = new Uint8Array(w*h);
        const par = new Int32Array(w*h).fill(-1);
        const si = sY*w+sX, gi = gY*w+gX;
        vis[si] = 1;
        const q = [si];
        const dirs = [[0,1],[0,-1],[1,0],[-1,0]];

        while (q.length > 0) {
            const i = q.shift();
            if (i === gi) {
                // Reconstruct
                const p = [];
                let c = gi;
                while (c !== si) {
                    const cx=c%w, cy=(c-cx)/w;
                    p.unshift({x:cx+0.5,y:cy+0.5});
                    c = par[c];
                    if (c===-1) return null;
                }
                return p;
            }
            const cx=i%w, cy=(i-cx)/w;
            for (const [dx,dy] of dirs) {
                const nx=cx+dx, ny=cy+dy;
                if (nx<0||nx>=w||ny<0||ny>=h) continue;
                const ni=ny*w+nx;
                if (vis[ni]||blocked.has(ni)) continue;
                if (grid[ny][nx]>0) continue;
                vis[ni]=1; par[ni]=i; q.push(ni);
            }
        }
        return null;
    }

    // ---- LOS ----
    function los(grid,x1,y1,x2,y2) {
        const dx=x2-x1,dy=y2-y1;
        const d=Math.sqrt(dx*dx+dy*dy);
        const n=Math.ceil(d*3);
        for (let i=1;i<n;i++) {
            const t=i/n;
            const tx=Math.floor(x1+dx*t),ty=Math.floor(y1+dy*t);
            if (tx>=0&&tx<grid[0].length&&ty>=0&&ty<grid.length&&grid[ty][tx]>0) return false;
        }
        return true;
    }

    // ---- Key press helper (for wasKeyJustPressed) ----
    function setKey(key) { inp._keysDown.add(key); }
    function pressOnce(key) {
        // Only set on frames where it wasn't set before (for edge detection)
        if (!prevKeys.has(key)) inp._keysDown.add(key);
    }

    // ---- Main bot tick (called from game loop) ----
    window.__BOT_TICK = function(dt, gs, GS) {
        if (won) return;

        // Save previous key state for edge control
        prevKeys = new Set(inp._keysDown);

        // Clear all input
        inp._keysDown.clear();
        inp._mouseDown = false;
        inp._mousePressed = false;
        inp._mouseDeltaX = 0;
        inp._mouseDeltaY = 0;
        inp._pointerLocked = true;

        switch (gs) {
            case GS.LOADING: break;

            case GS.TITLE:
                deathHandled = false; lcHandled = false;
                pressOnce('Enter');
                break;

            case GS.LEVEL_INTRO:
                deathHandled = false; lcHandled = false;
                pressOnce('Enter');
                break;

            case GS.PLAYING: {
                deathHandled = false; lcHandled = false;
                const p = G.player;
                if (!p || !p.alive) break;
                const map = G.map;
                if (!map) break;

                // Time limit check - force restart if over 1 minute
                if (G.levelTime > TIME_LIMIT) {
                    // Log this run as a timeout
                    runCount++;
                    const r = {
                        run: runCount,
                        level: G.currentLevelIndex + 1,
                        time: Math.round(G.levelTime*10)/10,
                        kills: G.levelKills,
                        reason: 'timeout',
                    };
                    deathLog.push(r);
                    console.log('[BOT] Timeout #'+runCount+': L'+r.level+' '+r.kills+'K');
                    if (r.kills > bestRun.kills) bestRun = {...r};
                    window.__AGENT_STATUS = {
                        status:'TIMEOUT', run:runCount, level:r.level,
                        deathLog, bestRun, won:false
                    };
                    // Force restart
                    G.restartLevel();
                    path = null; stuckHistory = [];
                    break;
                }

                const enemies = G.enemies || [];
                const doors = G.doors || [];

                // ---- Find closest visible enemy ----
                let tgt = null, tgtD = Infinity;
                for (const e of enemies) {
                    if (!e.alive) continue;
                    const ed = d2(p.pos.x,p.pos.y,e.pos.x,e.pos.y);
                    if (ed < 15 && ed < tgtD && los(map.grid,p.pos.x,p.pos.y,e.pos.x,e.pos.y)) {
                        tgt = e; tgtD = ed;
                    }
                }

                if (tgt) {
                    // ---- COMBAT ----
                    const ta = aTo(p.pos.x,p.pos.y,tgt.pos.x,tgt.pos.y);
                    const err = aD(p.angle, ta);
                    inp._mouseDeltaX = Math.sign(err) * Math.min(Math.abs(err/0.003), 300);

                    if (Math.abs(err) < 0.3) {
                        inp._mouseDown = true;
                        inp._mousePressed = true;
                    }

                    // Weapon selection
                    let best = 0;
                    if (tgtD<4 && p.weapons[1] && p.ammo.shells>0) best=1;
                    else if (p.weapons[2] && p.ammo.bullets>10) best=2;
                    else if (p.weapons[4] && p.ammo.cells>0) best=4;
                    else if (tgtD>5 && p.weapons[3] && p.ammo.rockets>0) best=3;
                    else if (p.weapons[1] && p.ammo.shells>0) best=1;
                    if (p.currentWeapon !== best) setKey('Digit'+(best+1));

                    // Movement: approach/retreat + strafe
                    if (tgtD > 5) setKey('KeyW');
                    else if (tgtD < 1.8) setKey('KeyS');
                    combatCycle++;
                    if (combatCycle % 40 < 20) setKey('KeyA');
                    else setKey('KeyD');

                } else {
                    // ---- NAVIGATION ----
                    // Target: nearest alive enemy (seek them out!)
                    let navTarget = null;
                    let navDist = Infinity;

                    // First priority: find enemies to kill
                    for (const e of enemies) {
                        if (!e.alive) continue;
                        const ed = d2(p.pos.x,p.pos.y,e.pos.x,e.pos.y);
                        if (ed < navDist) {
                            navTarget = {x:e.pos.x, y:e.pos.y, type:'enemy'};
                            navDist = ed;
                        }
                    }

                    // Fallback: objectives
                    if (!navTarget) {
                        const ld = G.levelData, os = G.objectiveSystem;
                        if (ld) {
                            const objs = ld.objectives || [];
                            for (let i=0; i<objs.length; i++) {
                                if (!os.objectives[i] || !os.objectives[i].completed) {
                                    navTarget = {x:objs[i].x, y:objs[i].y, type:objs[i].type};
                                    break;
                                }
                            }
                            if (!navTarget && ld.exitTrigger) {
                                navTarget = {x:ld.exitTrigger.x, y:ld.exitTrigger.y, type:'exit'};
                            }
                        }
                    }

                    if (navTarget) {
                        // Path finding
                        const key = Math.floor(navTarget.x)+','+Math.floor(navTarget.y);
                        if (!path || pathKey !== key || G.levelTime - pathTime > 2) {
                            path = bfs(map.grid, doors, p, p.pos.x, p.pos.y, navTarget.x, navTarget.y);
                            pathKey = key;
                            pathTime = G.levelTime;
                            pathIdx = 0;
                        }

                        let wp = {x:navTarget.x, y:navTarget.y};
                        if (path && path.length > 0) {
                            // Advance past reached waypoints
                            while (pathIdx < path.length-1 && d2(p.pos.x,p.pos.y,path[pathIdx].x,path[pathIdx].y) < 0.6) {
                                pathIdx++;
                            }
                            wp = path[Math.min(pathIdx, path.length-1)];
                        }

                        // Aim at waypoint
                        const ta = aTo(p.pos.x,p.pos.y,wp.x,wp.y);
                        const err = aD(p.angle, ta);
                        inp._mouseDeltaX = Math.sign(err) * Math.min(Math.abs(err/0.003), 300);

                        // Move forward when roughly aimed
                        if (Math.abs(err) < 1.0) setKey('KeyW');
                    } else {
                        // Wander
                        setKey('KeyW');
                        inp._mouseDeltaX = 30;
                    }

                    // Door opening: press E near closed doors
                    for (const d of doors) {
                        if (d.state === 0 && d2(p.pos.x,p.pos.y,d.x+0.5,d.y+0.5) < 1.6) {
                            pressOnce('KeyE');
                            // Also aim at door
                            const da = aTo(p.pos.x,p.pos.y,d.x+0.5,d.y+0.5);
                            const de = aD(p.angle, da);
                            inp._mouseDeltaX = Math.sign(de) * Math.min(Math.abs(de/0.003), 200);
                            setKey('KeyW');
                            break;
                        }
                    }

                    // Periodic E for interactions
                    if (Math.random() < 0.1) pressOnce('KeyE');

                    // Hold E for plant objectives
                    if (navTarget && navTarget.type === 'plant' && d2(p.pos.x,p.pos.y,navTarget.x,navTarget.y) < 1.5) {
                        setKey('KeyE');
                        inp._keysDown.delete('KeyW');
                    }
                }

                // ---- Stuck detection ----
                stuckHistory.push({x:p.pos.x, y:p.pos.y, t:G.levelTime});
                while (stuckHistory.length > 0 && G.levelTime - stuckHistory[0].t > STUCK_CHECK) {
                    stuckHistory.shift();
                }
                if (stuckHistory.length > 10) {
                    const old = stuckHistory[0];
                    if (d2(p.pos.x,p.pos.y,old.x,old.y) < STUCK_DIST) {
                        // STUCK! Try random recovery
                        path = null; pathTime = -999;
                        inp._mouseDeltaX = (Math.random()-0.5) * 500;
                        const rk = ['KeyW','KeyA','KeyD','KeyS'];
                        setKey(rk[Math.floor(Math.random()*4)]);
                        pressOnce('KeyE'); // Maybe a door
                    }
                }
                break;
            }

            case GS.DEATH: {
                if (!deathHandled) {
                    deathHandled = true;
                    runCount++;
                    const r = {
                        run: runCount,
                        level: G.currentLevelIndex + 1,
                        time: Math.round(G.levelTime*10)/10,
                        kills: G.levelKills,
                        reason: 'death',
                    };
                    deathLog.push(r);
                    console.log('[BOT] Death #'+runCount+': L'+r.level+' '+r.time+'s '+r.kills+'K');
                    if (r.kills > bestRun.kills) bestRun = {...r};
                    window.__AGENT_STATUS = {
                        status:'DIED', run:runCount, level:r.level,
                        deathLog, bestRun, won:false
                    };
                    path = null; stuckHistory = [];
                }
                pressOnce('Enter');
                break;
            }

            case GS.LEVEL_COMPLETE: {
                if (!lcHandled) {
                    lcHandled = true;
                    const lv = G.currentLevelIndex + 1;
                    console.log('[BOT] Level '+lv+' complete!');
                    if (G.levelKills > bestRun.kills) bestRun = {level:lv, time:Math.round(G.levelTime*10)/10, kills:G.levelKills};
                    window.__AGENT_STATUS = {
                        status:'LEVEL_COMPLETE', run:runCount, level:lv,
                        deathLog, bestRun, won:false
                    };
                    path = null; stuckHistory = [];
                }
                pressOnce('Enter');
                break;
            }

            case GS.VICTORY: {
                won = true;
                console.log('[BOT] VICTORY!');
                window.__AGENT_STATUS = {
                    status:'VICTORY', run:runCount, deathLog,
                    bestRun:{level:5, kills:G.totalKills}, won:true,
                    totalKills:G.totalKills, totalTime:Math.round(G.totalTime*10)/10
                };
                window.__AGENT_WON = true;
                break;
            }

            case GS.PAUSED:
                pressOnce('Escape');
                break;
        }
    };

    window.__AGENT_STOP = () => {
        window.__BOT_TICK = null;
        console.log('[BOT] Stopped.');
    };
    window.__AGENT_STATUS = { status:'STARTED', run:0, deathLog:[], bestRun:{level:0,kills:0}, won:false };
    console.log('[BOT] v4 initialized (in-loop, 1min limit).');
})();
