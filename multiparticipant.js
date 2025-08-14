// This script plays five copies of participant.webm at the same resolution and fps as the webcam test
// and records the average frame time and standard deviation across all five videos.

const NUM_VIDEOS = 5;
const VIDEO_SRC = 'participant.webm';
const videoElements = [];
let videoResolution = [640, 360]; // Default, will be set by test
let videoFps = 30; // Default, will be set by test

function stddev(arr) {
    if (!arr.length) return 'Error';
    const mean = arr.reduce((a,b)=>a+b,0)/arr.length;
    const sqDiffs = arr.map(v => Math.pow(v-mean,2));
    const avgSqDiff = sqDiffs.reduce((a,b)=>a+b,0)/arr.length;
    return Math.sqrt(avgSqDiff).toFixed(3);
}

function setupVideos(resolution, fps) {
    videoResolution = resolution;
    videoFps = fps;
    const container = document.getElementById('videoContainer');
    container.innerHTML = '';
    videoElements.length = 0;
    for (let i = 0; i < NUM_VIDEOS; i++) {
        const v = document.createElement('video');
        v.src = VIDEO_SRC;
        v.width = resolution[0];
        v.height = resolution[1];
        v.autoplay = true;
        v.loop = true;
        v.muted = true;
        v.playsInline = true;
        v.preload = 'auto';
        container.appendChild(v);
        videoElements.push(v);
    }
}

async function measureFrameTimes(durationMs = 5000) {
    // Wait for all videos to be ready
    await Promise.all(videoElements.map(v => new Promise(resolve => {
        v.onplaying = () => resolve();
    })));
    let frameTimes = Array(NUM_VIDEOS).fill().map(() => []);
    let prevTimes = Array(NUM_VIDEOS).fill(null);
    const endTime = performance.now() + durationMs;
    function measure(i) {
        if (performance.now() > endTime) return;
        let now = performance.now();
        if (prevTimes[i]) {
            frameTimes[i].push(now - prevTimes[i]);
        }
        prevTimes[i] = now;
        videoElements[i].requestVideoFrameCallback(() => measure(i));
    }
    for (let i = 0; i < NUM_VIDEOS; i++) {
        videoElements[i].requestVideoFrameCallback(() => measure(i));
    }
    await new Promise(resolve => setTimeout(resolve, durationMs + 100));
    // Calculate average and stddev across all videos
    let allFrameTimes = frameTimes.flat();
    let avg = allFrameTimes.length ? (allFrameTimes.reduce((a,b)=>a+b,0)/allFrameTimes.length).toFixed(3) : 'Error';
    let sd = allFrameTimes.length ? stddev(allFrameTimes) : 'Error';
    return { avg, sd };
}

window.setupVideos = setupVideos;
window.measureFrameTimes = measureFrameTimes;
