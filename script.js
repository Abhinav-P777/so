const startBtn = document.getElementById('startBtn');
const stopBtn = document.getElementById('stopBtn');
const saveBtn = document.getElementById('saveBtn');
const pitchControl = document.getElementById('pitchControl'); // Pitch control slider
const distortionControl = document.getElementById('distortionControl'); // Distortion control slider
const canvas = document.getElementById('spectrum');
const canvasCtx = canvas.getContext('2d');

let audioCtx;
let analyser;
let source;
let dataArray;
let bufferLength;
let mediaRecorder;
let recordedChunks = [];
let animationFrameId;
let pitchShiftNode;
let distortionNode;

startBtn.addEventListener('click', async () => {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

        if (!audioCtx) {
            audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        } else {
            audioCtx.close().then(() => {
                audioCtx = new (window.AudioContext || window.webkitAudioContext)();
            });
        }

        if (analyser) {
            analyser.disconnect();
        }

        analyser = audioCtx.createAnalyser();
        source = audioCtx.createMediaStreamSource(stream);

        // Create pitch shift node
        pitchShiftNode = audioCtx.createGain();
        pitchShiftNode.gain.value = 1; // Default pitch shift is 1 (no change)

        // Create distortion node
        distortionNode = audioCtx.createWaveShaper();
        distortionNode.curve = makeDistortionCurve(400); // Adjust the value for different distortion levels
        distortionNode.oversample = '4x';

        // Connect nodes
        source.connect(pitchShiftNode);
        pitchShiftNode.connect(distortionNode);
        distortionNode.connect(analyser);

        analyser.fftSize = 256;
        bufferLength = analyser.frequencyBinCount;
        dataArray = new Uint8Array(bufferLength);

        mediaRecorder = new MediaRecorder(stream);
        mediaRecorder.ondataavailable = event => {
            if (event.data.size > 0) {
                recordedChunks.push(event.data);
            }
        };
        mediaRecorder.onstop = () => {
            const blob = new Blob(recordedChunks, { type: 'audio/webm' });
            recordedChunks = [];
            const url = URL.createObjectURL(blob);
            saveBtn.href = url;
            saveBtn.download = 'recording.webm';
            saveBtn.style.display = 'block';
        };

        mediaRecorder.start();

        startBtn.disabled = true;
        stopBtn.disabled = false;
        saveBtn.style.display = 'none';

        draw();

        // Update pitch shift based on slider value
        pitchControl.addEventListener('input', (event) => {
            const pitchValue = parseFloat(event.target.value);
            pitchShiftNode.gain.value = pitchValue;
        });

        // Update distortion level based on slider value
        distortionControl.addEventListener('input', (event) => {
            const distortionValue = parseFloat(event.target.value);
            distortionNode.curve = makeDistortionCurve(distortionValue);
        });
    } catch (err) {
        console.error('Error accessing audio stream:', err);
    }
});

stopBtn.addEventListener('click', () => {
    if (audioCtx) {
        audioCtx.close().then(() => {
            audioCtx = null;
            analyser = null;
            source = null;
            dataArray = null;
            bufferLength = 0;
            cancelAnimationFrame(animationFrameId);
            if (mediaRecorder) {
                mediaRecorder.stop();
            }
            startBtn.disabled = false;
            stopBtn.disabled = true;
        }).catch(err => console.error('Error closing audio context:', err));
    }
});

function draw() {
    animationFrameId = requestAnimationFrame(draw);

    if (!analyser) return;

    analyser.getByteFrequencyData(dataArray);

    canvasCtx.clearRect(0, 0, canvas.width, canvas.height);

    const barWidth = (canvas.width / bufferLength) * 2.5;
    let barHeight;
    let x = 0;

    for (let i = 0; i < bufferLength; i++) {
        barHeight = dataArray[i];
        canvasCtx.fillStyle = `rgb(${barHeight + 100}, 50, 50)`;
        canvasCtx.fillRect(x, canvas.height - barHeight / 2, barWidth, barHeight / 2);
        x += barWidth + 1;
    }
}

// Function to create a distortion curve
function makeDistortionCurve(amount) {
    let k = typeof amount === 'number' ? amount : 50,
        n_samples = 44100,
        curve = new Float32Array(n_samples),
        x;

    for (let i = 0; i < n_samples; ++i) {
        x = i * 2 / n_samples - 1;
        curve[i] = (3 + k) * x * 20 * Math.PI / (Math.PI + k * Math.abs(x));
    }

    return curve;
}
