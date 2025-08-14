const resolutions = [
    [192, 108], [320, 180], [640, 360], [1280, 720], [1920, 1080]
];
const frameRates = [15, 20, 30];
const video = document.getElementById('video');
const startBtn = document.getElementById('startTest');
const resultsTable = document.getElementById('resultsTable').querySelector('tbody');

async function testCamera(resolution, fps) {
    let onsetLatency = null;
    let frameTimes = [];
    let droppedFrames = 0;
    let actualFps = 0;
    let lastFrameTime = null;
    let frameCount = 0;
    let startTime = performance.now();
    let videoTrack;
    let stream;
    let frameTimestamps = [];

    try {
        const constraints = {
            video: {
                width: { exact: resolution[0] },
                height: { exact: resolution[1] },
                frameRate: { exact: fps }
            }
        };
        const connectTime = performance.now();
        stream = await navigator.mediaDevices.getUserMedia(constraints);
        video.srcObject = stream;
        videoTrack = stream.getVideoTracks()[0];
        // Wait for video to show new frame
        await new Promise(resolve => {
            const handler = () => {
                onsetLatency = performance.now() - connectTime;
                video.removeEventListener('playing', handler);
                resolve();
            };
            video.addEventListener('playing', handler);
        });
        // Measure frame time for 2 seconds
        let prev = null;
        let frames = 0;
        let dropped = 0;
        let timestamps = [];
        const measureTime = 2000;
        const endTime = performance.now() + measureTime;
        function onFrame() {
            if (performance.now() > endTime) return;
            timestamps.push(performance.now());
            frames++;
            if (prev) {
                let dt = timestamps[timestamps.length-1] - prev;
                frameTimes.push(dt);
                if (dt > (1000/fps)*1.5) dropped++;
            }
            prev = timestamps[timestamps.length-1];
            requestAnimationFrame(onFrame);
        }
        requestAnimationFrame(onFrame);
        await new Promise(resolve => setTimeout(resolve, measureTime+100));
        actualFps = frames / (measureTime/1000);
        droppedFrames = dropped;
    } catch (e) {
        onsetLatency = 'Error';
        frameTimes = [];
        actualFps = 0;
        droppedFrames = 'Error';
    } finally {
        if (videoTrack) videoTrack.stop();
        if (stream) stream.getTracks().forEach(t => t.stop());
    }
    return {
        resolution: `${resolution[0]}x${resolution[1]}`,
        fps,
        frameTime: frameTimes.length ? (frameTimes.reduce((a,b)=>a+b,0)/frameTimes.length).toFixed(1) : 'Error',
        onsetLatency: typeof onsetLatency === 'number' ? onsetLatency.toFixed(1) : onsetLatency,
        actualFps: actualFps.toFixed(1),
        droppedFrames
    };
}

async function runTests() {
    startBtn.disabled = true;
    resultsTable.innerHTML = '';
    for (let res of resolutions) {
        for (let fps of frameRates) {
            const result = await testCamera(res, fps);
            const row = document.createElement('tr');
            row.innerHTML = `<td>${result.resolution}</td><td>${result.fps}</td><td>${result.frameTime}</td><td>${result.onsetLatency}</td><td>${result.actualFps}</td><td>${result.droppedFrames}</td>`;
            resultsTable.appendChild(row);
        }
    }
    startBtn.disabled = false;
}

startBtn.addEventListener('click', runTests);
