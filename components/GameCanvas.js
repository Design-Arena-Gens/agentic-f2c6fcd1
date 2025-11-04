'use client';

import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { PointerLockControls } from 'three/examples/jsm/controls/PointerLockControls.js';

export default function GameCanvas() {
  const containerRef = useRef(null);
  const [isLocked, setIsLocked] = useState(false);
  const [health, setHealth] = useState(100);
  const [score, setScore] = useState(0);
  const [wave, setWave] = useState(1);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0b0f14);

    const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 2000);
    camera.position.set(0, 1.6, 5);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.shadowMap.enabled = true;
    container.appendChild(renderer.domElement);

    const ambient = new THREE.AmbientLight(0xbfd6ff, 0.6);
    scene.add(ambient);
    const sun = new THREE.DirectionalLight(0xffffff, 1.0);
    sun.position.set(8, 18, 12);
    sun.castShadow = true;
    scene.add(sun);

    // Floor
    const floorGeo = new THREE.PlaneGeometry(100, 100);
    const floorMat = new THREE.MeshStandardMaterial({ color: 0x1a2330, roughness: 1 });
    const floor = new THREE.Mesh(floorGeo, floorMat);
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    scene.add(floor);

    // Arena walls (simple perimeter)
    const wallMat = new THREE.MeshStandardMaterial({ color: 0x0f1720, metalness: 0.1, roughness: 0.9 });
    const wallHeight = 3;
    const wallThickness = 1;
    const arenaHalfSize = 40;
    const walls = [];
    const addWall = (w, h, d, x, y, z) => {
      const geo = new THREE.BoxGeometry(w, h, d);
      const mesh = new THREE.Mesh(geo, wallMat);
      mesh.position.set(x, y, z);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      scene.add(mesh);
      walls.push(mesh);
    };
    addWall(arenaHalfSize * 2 + wallThickness * 2, wallHeight, wallThickness, 0, wallHeight / 2, -arenaHalfSize - wallThickness / 2); // north
    addWall(arenaHalfSize * 2 + wallThickness * 2, wallHeight, wallThickness, 0, wallHeight / 2, arenaHalfSize + wallThickness / 2); // south
    addWall(wallThickness, wallHeight, arenaHalfSize * 2 + wallThickness * 2, -arenaHalfSize - wallThickness / 2, wallHeight / 2, 0); // west
    addWall(wallThickness, wallHeight, arenaHalfSize * 2 + wallThickness * 2, arenaHalfSize + wallThickness / 2, wallHeight / 2, 0); // east

    // Grid helper (visual aid)
    const grid = new THREE.GridHelper(100, 50, 0x1e293b, 0x0b1220);
    scene.add(grid);

    // Controls
    const controls = new PointerLockControls(camera, renderer.domElement);
    controls.minPolarAngle = Math.PI / 2; // prevent looking up/down too far
    controls.maxPolarAngle = Math.PI / 2;

    const keyState = { w: false, a: false, s: false, d: false };
    const velocity = new THREE.Vector3();
    const direction = new THREE.Vector3();

    function onKeyDown(e) {
      switch (e.code) {
        case 'KeyW': keyState.w = true; break;
        case 'KeyA': keyState.a = true; break;
        case 'KeyS': keyState.s = true; break;
        case 'KeyD': keyState.d = true; break;
      }
    }
    function onKeyUp(e) {
      switch (e.code) {
        case 'KeyW': keyState.w = false; break;
        case 'KeyA': keyState.a = false; break;
        case 'KeyS': keyState.s = false; break;
        case 'KeyD': keyState.d = false; break;
      }
    }

    const raycaster = new THREE.Raycaster();

    // Enemies
    const enemies = [];
    const enemyGeo = new THREE.BoxGeometry(0.8, 1.6, 0.8);
    const enemyMaterial = new THREE.MeshStandardMaterial({ color: 0xec4899, roughness: 0.6, metalness: 0.2 });

    function spawnEnemy() {
      const angle = Math.random() * Math.PI * 2;
      const radius = arenaHalfSize * 0.9;
      const x = Math.cos(angle) * radius;
      const z = Math.sin(angle) * radius;
      const mesh = new THREE.Mesh(enemyGeo, enemyMaterial.clone());
      mesh.position.set(x, 0.8, z);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      mesh.userData.health = 100;
      scene.add(mesh);
      enemies.push(mesh);
    }

    function spawnWave(count) {
      for (let i = 0; i < count; i++) spawnEnemy();
    }

    let enemyTargetingCooldown = 0;

    function clampToArena(pos) {
      pos.x = THREE.MathUtils.clamp(pos.x, -arenaHalfSize + 1.5, arenaHalfSize - 1.5);
      pos.z = THREE.MathUtils.clamp(pos.z, -arenaHalfSize + 1.5, arenaHalfSize - 1.5);
    }

    function handleMovement(delta) {
      const speed = 10; // units per second
      velocity.set(0, 0, 0);

      direction.set(0, 0, 0);
      if (keyState.w) direction.z -= 1;
      if (keyState.s) direction.z += 1;
      if (keyState.a) direction.x -= 1;
      if (keyState.d) direction.x += 1;
      if (direction.lengthSq() > 0) direction.normalize();

      // Move relative to camera orientation (Y-axis only)
      const moveX = direction.x * speed * delta;
      const moveZ = direction.z * speed * delta;

      const yaw = controls.getObject().rotation.y;
      const sin = Math.sin(yaw);
      const cos = Math.cos(yaw);

      const dx = moveX * cos - moveZ * sin;
      const dz = moveX * sin + moveZ * cos;

      const obj = controls.getObject();
      obj.position.x += dx;
      obj.position.z += dz;

      clampToArena(obj.position);
    }

    function enemyAI(delta) {
      const player = controls.getObject().position;
      for (let i = enemies.length - 1; i >= 0; i--) {
        const e = enemies[i];
        if (!e) continue;
        const dir = new THREE.Vector3().subVectors(player, e.position);
        const dist = dir.length();
        if (dist > 0.001) dir.normalize();

        // Move enemy toward the player
        const speed = THREE.MathUtils.lerp(2.8, 4.8, Math.random() * 0.2);
        e.position.addScaledVector(dir, speed * delta);
        clampToArena(e.position);

        // Face the player
        e.lookAt(player.x, e.position.y, player.z);

        // Damage player if close
        if (dist < 1.2) {
          setHealth((h) => Math.max(0, h - 10 * delta));
        }

        // Remove dead enemies
        if (e.userData.health <= 0) {
          scene.remove(e);
          enemies.splice(i, 1);
          setScore((s) => s + 100);
        }
      }

      // Spawn next wave when cleared
      if (enemies.length === 0 && enemyTargetingCooldown <= 0) {
        setWave((w) => {
          const next = w + 1;
          spawnWave(Math.min(5 + next, 20));
          return next;
        });
        enemyTargetingCooldown = 1.5;
      }

      if (enemyTargetingCooldown > 0) enemyTargetingCooldown -= delta;
    }

    function shoot() {
      // Raycast from camera forward
      raycaster.setFromCamera(new THREE.Vector2(0, 0), camera);
      const intersects = raycaster.intersectObjects(enemies, false);
      if (intersects.length > 0) {
        const hit = intersects[0].object;
        hit.userData.health -= 50; // 2 shots to kill
        // brief hit flash
        const orig = hit.material.color.getHex();
        hit.material.color.setHex(0xffffff);
        setTimeout(() => hit.material.color.setHex(orig), 60);
      }

      // Muzzle flash (simple screen flash)
      screenFlash(0.12);
    }

    // Screen flash overlay via CSS filter
    let flashStrength = 0;
    function screenFlash(amount) {
      flashStrength = Math.min(1, flashStrength + amount);
    }

    const onMouseDown = (e) => {
      if (!isLocked) return;
      if (e.button === 0) shoot();
    };

    // Lock controls when requested
    function lockPointer() {
      controls.lock();
    }

    function onLock() { setIsLocked(true); }
    function onUnlock() { setIsLocked(false); }

    controls.addEventListener('lock', onLock);
    controls.addEventListener('unlock', onUnlock);

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('mousedown', onMouseDown);

    function onResize() {
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
    }
    window.addEventListener('resize', onResize);

    // Initial wave
    spawnWave(6);

    let last = performance.now();
    let rafId;
    function animate(now) {
      const delta = Math.min(0.05, (now - last) / 1000);
      last = now;

      if (isLocked) {
        handleMovement(delta);
        enemyAI(delta);
      }

      // Apply flash
      if (flashStrength > 0) {
        const v = flashStrength * 0.5;
        renderer.toneMappingExposure = 1 + v;
        flashStrength = Math.max(0, flashStrength - delta * 2.5);
      } else {
        renderer.toneMappingExposure = 1;
      }

      renderer.render(scene, camera);
      rafId = requestAnimationFrame(animate);
    }
    rafId = requestAnimationFrame(animate);

    return () => {
      cancelAnimationFrame(rafId);
      window.removeEventListener('resize', onResize);
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('mousedown', onMouseDown);
      controls.removeEventListener('lock', onLock);
      controls.removeEventListener('unlock', onUnlock);
      renderer.dispose();
      container.removeChild(renderer.domElement);
    };
  }, [isLocked]);

  const healthPct = Math.max(0, Math.min(100, Math.round(health)));

  return (
    <div id="game-container" ref={containerRef}>
      {!isLocked && (
        <div className="overlay">
          <div className="panel">
            <h1>Web FPS Arena</h1>
            <p>WASD to move, mouse to aim, click to shoot.</p>
            <p>Defeat waves of approaching enemies. Stay alive.</p>
            <button className="btn" onClick={() => {
              // Lock pointer by requesting pointer lock via a transient user gesture
              const canvas = containerRef.current?.querySelector('canvas');
              if (canvas && canvas.requestPointerLock) canvas.requestPointerLock();
              // Some browsers require programmatic lock via controls after click
              document.addEventListener('pointerlockchange', function once() {
                document.removeEventListener('pointerlockchange', once);
              });
            }}>Click to Play</button>
          </div>
        </div>
      )}

      <div className="hud">
        <div className="top">
          <div className="pill">Score: {score}</div>
          <div className="pill">Wave: {wave}</div>
          <div className="pill">
            <div className="healthbar">
              <div className="fill" style={{ width: `${healthPct}%`, background: healthPct > 30 ? 'linear-gradient(90deg,#22c55e,#84cc16)' : 'linear-gradient(90deg,#ef4444,#f59e0b)' }} />
            </div>
          </div>
        </div>
        <div className="bottom" />
      </div>
      <div className="crosshair" />
    </div>
  );
}
