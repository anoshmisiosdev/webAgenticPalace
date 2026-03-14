let scene, camera, renderer;
let xrSession = null;
let xrRefSpace = null;

init();
animate();

function init() {
    // Create scene
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x101010);

    // Create camera
    camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);

    // Create renderer
    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.xr.enabled = true;
    document.body.appendChild(renderer.domElement);

    // Add a simple cube
    const geometry = new THREE.BoxGeometry(1, 1, 1);
    const material = new THREE.MeshBasicMaterial({ color: 0x00ff00 });
    const cube = new THREE.Mesh(geometry, material);
    cube.position.set(0, 0, -5);
    scene.add(cube);

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
}

function onEnterXR() {
    navigator.xr.requestSession('immersive-vr').then(onSessionStarted);
}

function onSessionStarted(session) {
    xrSession = session;
    renderer.xr.setSession(session);

    session.requestReferenceSpace('local').then((refSpace) => {
        xrRefSpace = refSpace;
    });

    session.addEventListener('end', onSessionEnded);
}

function onSessionEnded() {
    xrSession = null;
    renderer.xr.setSession(null);
    document.getElementById('info').innerHTML = 'XR session ended.';
}

function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}

function animate() {
    renderer.setAnimationLoop(render);
}

function render() {
    // Rotate the cube if it exists
    if (scene.children.length > 0) {
        scene.children[0].rotation.x += 0.01;
        scene.children[0].rotation.y += 0.01;
    }
    renderer.render(scene, camera);
}