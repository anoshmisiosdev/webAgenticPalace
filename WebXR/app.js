import * as GaussianSplats3D from '../node_modules/@mkkellogg/gaussian-splats-3d';
import * as THREE from '../node_modules/three';

let viewer;

function init() {
    // Create scene
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x101010);

    // Create viewer
    viewer = new GaussianSplats3D.Viewer({
        threescene: scene,
        pointSize: 0.05,
        pointColor: (point) => {
            return new THREE.Color(point.color[0] / 255, point.color[1] / 255, point.color[2] / 255);
        },
    });

    // Add splat scene
    viewer.addSplatScene('../Example/TestWorld.spz')
    .then(() => {
        viewer.start(); // This starts the rendering loop and handles WebXR
    });
}

init();