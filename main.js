const resolutions = [
    [192, 108],
    [320, 180],
    [384, 216],
    [512, 288],
    [640, 360],
    [1024, 576],
    [1280, 720],
    [1920, 1080]
];
const frameRates = [15, 20, 30];
const video = document.getElementById('video');
const startBtn = document.getElementById('startTest');
const resultsTable = document.getElementById('resultsTable').querySelector('tbody');


async function testCamera(resolution, fps) {
    let onsetLatency = null;
    let frameTimes = [];
    let gpuDrawTimes = [];
    let actualFps = 0;
    let videoTrack;
    let stream;

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
        // Measure frame time and GPU draw time for 2 seconds
        let prev = null;
        let frames = 0;
        const measureTime = 2000;
        const endTime = performance.now() + measureTime;
        let gpuPrev = null;
        function onFrame() {
            if (performance.now() > endTime) return;
            let now = performance.now();
            frames++;
            if (prev) {
                let dt = now - prev;
                frameTimes.push(dt);
            }
            prev = now;
            requestAnimationFrame(onFrame);
        }
        requestAnimationFrame(onFrame);

        // GPU draw time using requestVideoFrameCallback
        let gpuFrames = 0;
        function gpuFrameCallback(now, metadata) {
            if (gpuFrames > 0 && gpuPrev) {
                gpuDrawTimes.push(now - gpuPrev);
            }
            gpuPrev = now;
            gpuFrames++;
            if (performance.now() < endTime) {
                video.requestVideoFrameCallback(gpuFrameCallback);
            }
        }
        if (video.requestVideoFrameCallback) {
            video.requestVideoFrameCallback(gpuFrameCallback);
        }

        await new Promise(resolve => setTimeout(resolve, measureTime+100));
        actualFps = frames / (measureTime/1000);
    } catch (e) {
        onsetLatency = 'Error';
        frameTimes = [];
        gpuDrawTimes = [];
        actualFps = 0;
    } finally {
        if (videoTrack) videoTrack.stop();
        if (stream) stream.getTracks().forEach(t => t.stop());
    }
    return {
        resolution: `${resolution[0]}x${resolution[1]}`,
        fps,
        frameTime: frameTimes.length ? (frameTimes.reduce((a,b)=>a+b,0)/frameTimes.length).toFixed(1) : 'Error',
        onsetLatency: typeof onsetLatency === 'number' ? onsetLatency.toFixed(1) : onsetLatency,
        gpuDrawTime: gpuDrawTimes.length ? (gpuDrawTimes.reduce((a,b)=>a+b,0)/gpuDrawTimes.length).toFixed(2) : 'N/A',
        actualFps: actualFps.toFixed(1)
    };
}

async function runTests() {
    startBtn.disabled = true;
    resultsTable.innerHTML = '';
    for (let res of resolutions) {
        for (let fps of frameRates) {
            const result = await testCamera(res, fps);
            const row = document.createElement('tr');
            row.innerHTML = `<td>${result.resolution}</td><td>${result.fps}</td><td>${result.frameTime}</td><td>${result.onsetLatency}</td><td>${result.gpuDrawTime}</td><td>${result.actualFps}</td>`;
            resultsTable.appendChild(row);
        }
    }
    startBtn.disabled = false;
}

startBtn.addEventListener('click', runTests);
