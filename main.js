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
const canvas = document.getElementById('canvas');
const startBtn = document.getElementById('startTest');
const downloadBtn = document.getElementById('downloadCsv');
const resultsTable = document.getElementById('resultsTable').querySelector('tbody');
let lastResults = [];


async function testCamera(resolution, fps) {
    let onsetLatency = null;
    let frameTimes = [];
    let actualFps = 0;
    let getUserMediaCpuTime = null;
    let canvasDrawTimes = [];
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
        const gUMStart = performance.now();
        stream = await navigator.mediaDevices.getUserMedia(constraints);
        getUserMediaCpuTime = performance.now() - gUMStart;
        video.srcObject = stream;
        videoTrack = stream.getVideoTracks()[0];
        // Wait for video to show new frame
        await new Promise(resolve => {
            const handler = () => {
                onsetLatency = performance.now() - gUMStart;
                video.removeEventListener('playing', handler);
                resolve();
            };
            video.addEventListener('playing', handler);
        });
        // Set canvas size
        canvas.width = resolution[0];
        canvas.height = resolution[1];
        // Measure frame time and canvas draw time for 2 seconds
        let frames = 0;
        let prev = null;
        const measureTime = 2000;
        const endTime = performance.now() + measureTime;
        function countFrame(now, metadata) {
            if (performance.now() > endTime) return;
            frames++;
            if (prev) {
                frameTimes.push(now - prev);
            }
            prev = now;
            // Measure canvas draw time
            const ctx = canvas.getContext('2d');
            const drawStart = performance.now();
            ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
            const drawEnd = performance.now();
            canvasDrawTimes.push(drawEnd - drawStart);
            video.requestVideoFrameCallback(countFrame);
        }
        if (video.requestVideoFrameCallback) {
            video.requestVideoFrameCallback(countFrame);
            await new Promise(resolve => setTimeout(resolve, measureTime+100));
            actualFps = frames / (measureTime/1000);
        } else {
            // fallback to requestAnimationFrame
            let rafFrames = 0;
            let rafPrev = null;
            function rafFrame() {
                if (performance.now() > endTime) return;
                rafFrames++;
                let now = performance.now();
                if (rafPrev) frameTimes.push(now - rafPrev);
                // Measure canvas draw time
                const ctx = canvas.getContext('2d');
                const drawStart = performance.now();
                ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
                const drawEnd = performance.now();
                canvasDrawTimes.push(drawEnd - drawStart);
                rafPrev = now;
                requestAnimationFrame(rafFrame);
            }
            requestAnimationFrame(rafFrame);
            await new Promise(resolve => setTimeout(resolve, measureTime+100));
            actualFps = rafFrames / (measureTime/1000);
        }
    } catch (e) {
        onsetLatency = 'Error';
        frameTimes = [];
        getUserMediaCpuTime = 'Error';
        canvasDrawTimes = [];
        actualFps = 0;
    } finally {
        if (videoTrack) videoTrack.stop();
        if (stream) stream.getTracks().forEach(t => t.stop());
    }
    return {
        resolution: `${resolution[0]}x${resolution[1]}`,
        fps,
        frameTime: frameTimes.length ? (frameTimes.reduce((a,b)=>a+b,0)/frameTimes.length).toFixed(1) : 'Error',
        getUserMediaCpuTime: typeof getUserMediaCpuTime === 'number' ? getUserMediaCpuTime.toFixed(1) : getUserMediaCpuTime,
        onsetLatency: typeof onsetLatency === 'number' ? onsetLatency.toFixed(1) : onsetLatency,
        canvasDrawTime: canvasDrawTimes.length ? (canvasDrawTimes.reduce((a,b)=>a+b,0)/canvasDrawTimes.length).toFixed(3) : 'Error',
        actualFps: actualFps.toFixed(1)
    };
}

async function runTests() {
    startBtn.disabled = true;
    resultsTable.innerHTML = '';
    lastResults = [];
    // Warm-up run (disposable, not recorded)
    try {
        await testCamera(resolutions[0], frameRates[0]);
    } catch (e) {}
    // Full sequence
    for (let res of resolutions) {
        for (let fps of frameRates) {
            let result;
            try {
                result = await testCamera(res, fps);
            } catch (e) {
                result = {
                    resolution: `${res[0]}x${res[1]}`,
                    fps,
                    frameTime: 'Error',
                    getUserMediaCpuTime: 'Error',
                    onsetLatency: 'Error',
                    canvasDrawTime: 'Error',
                    actualFps: 'Error'
                };
            }
            lastResults.push(result);
            const row = document.createElement('tr');
            row.innerHTML = `<td>${result.resolution}</td><td>${result.fps}</td><td>${result.frameTime}</td><td>${result.getUserMediaCpuTime}</td><td>${result.onsetLatency}</td><td>${result.canvasDrawTime}</td><td>${result.actualFps}</td>`;
            resultsTable.appendChild(row);
        }
    }
function downloadTableAsCSV() {
    if (!lastResults.length) return;
    const headers = ['Resolution','FPS','Frame Time (ms)','getUserMedia CPU Time (ms)','Onset Latency (ms)','Canvas Draw Time (ms)','Actual FPS'];
    const rows = lastResults.map(r => [r.resolution, r.fps, r.frameTime, r.getUserMediaCpuTime, r.onsetLatency, r.canvasDrawTime, r.actualFps]);
    let csvContent = headers.join(',') + '\n';
    csvContent += rows.map(row => row.join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'camera_test_results.csv';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

downloadBtn.addEventListener('click', downloadTableAsCSV);
    startBtn.disabled = false;
}

startBtn.addEventListener('click', runTests);
