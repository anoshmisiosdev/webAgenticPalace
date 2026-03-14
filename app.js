import * as THREE from 'three';
import { SplatMesh } from '@sparkjsdev/spark';
import { defineConfig } from 'vite';
export default defineConfig({
  server: {
    // Listen on all network addresses (required for external access)
    host: '0.0.0.0', 
    // Specify the hostnames Vite is allowed to respond to
    allowedHosts: [
      'webxr.riyanshomelab.com',
      'localhost',
    ],
  },
});

let scene, camera, renderer;

function init() {
    


    // Create scene
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x101010);

    // Create camera
    camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.set(0, 0, 5);

    // Create renderer
    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.xr.enabled = true;
    document.body.appendChild(renderer.domElement);

    // Load and add the splat mesh
    const splat = new SplatMesh({ url: '../Example/TestWorld.spz' });
    scene.add(splat);

    // Check WebXR support
    if ('xr' in navigator) {
        navigator.xr.isSessionSupported('immersive-vr').then((supported) => {
            if (supported) {
                document.getElementById('enterXR').addEventListener('click', onEnterXR);
                document.getElementById('info').innerHTML = 'WebXR supported. Click to enter VR.';
            } else {
                document.getElementById('info').innerHTML = 'WebXR immersive-vr not supported.';
            }
        });
    } else {
        document.getElementById('info').innerHTML = 'WebXR not supported.';
    }

    window.addEventListener('resize', onWindowResize, false);

    // Start render loop
    renderer.setAnimationLoop(render);
}

function onEnterXR() {
    navigator.xr.requestSession('immersive-vr').then(onSessionStarted);
}

function onSessionStarted(session) {
    renderer.xr.setSession(session);
    session.addEventListener('end', onSessionEnded);
}

function onSessionEnded() {
    renderer.xr.setSession(null);
    document.getElementById('info').innerHTML = 'XR session ended.';
}

function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}

function render() {
    renderer.render(scene, camera);
}

init();