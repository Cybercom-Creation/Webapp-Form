// src/hooks/useAudioDetection.js
import { useState, useEffect, useRef, useCallback } from 'react';

// --- Configuration ---
const NOISE_THRESHOLD_DB = -5; // Example threshold in dBFS (-40 is moderate background noise)
const SMOOTHING_TIME_CONSTANT = 0.1;
const FFT_SIZE = 256;

export const useAudioDetection = (isActive) => {
    const [isAboveThreshold, setIsAboveThreshold] = useState(false);
    const [currentDecibels, setCurrentDecibels] = useState(-Infinity);
    const [audioError, setAudioError] = useState(null);
    const [isMonitoring, setIsMonitoring] = useState(false);

    const audioContextRef = useRef(null);
    const analyserRef = useRef(null);
    const mediaStreamSourceRef = useRef(null);
    const audioStreamRef = useRef(null);
    const animationFrameRef = useRef(null);
    const dataArrayRef = useRef(null);
    // Ref to track if we are *currently* in the process of starting/stopping
    const processingRef = useRef(false);

    // --- Analyse Audio Function ---
    const analyseAudio = useCallback(() => {
        if (!analyserRef.current || !dataArrayRef.current || !isMonitoring) {
            // Added !isMonitoring check here for safety
            // console.warn("AnalyseAudio called but analyser/dataArray not ready or not monitoring.");
            animationFrameRef.current = null; // Ensure loop stops if state is wrong
            return;
        }

        try {
            analyserRef.current.getByteFrequencyData(dataArrayRef.current);

            let sumSquares = 0;
            for (const amplitude of dataArrayRef.current) {
                const normalizedAmplitude = (amplitude / 128.0) - 1.0;
                sumSquares += normalizedAmplitude * normalizedAmplitude;
            }
            const rms = Math.sqrt(sumSquares / dataArrayRef.current.length);
            const dbfs = rms > 0 ? 20 * Math.log10(rms) : -Infinity;

            // --- DEBUG LOG ---
            // Log frequently to see if analysis is running and the detected level
            console.log(`[useAudioDetection] Analysing... dBFS: ${dbfs.toFixed(2)} (Threshold: ${NOISE_THRESHOLD_DB})`);
            // --- END DEBUG LOG ---

            setCurrentDecibels(dbfs);
            const currentlyAbove = dbfs < NOISE_THRESHOLD_DB;

            // Update state only on change
            setIsAboveThreshold(prev => {
                if (prev !== currentlyAbove) {
                    console.log(`Noise level ${currentlyAbove ? 'EXCEEDED' : 'BELOW'} threshold (${NOISE_THRESHOLD_DB} dBFS). Current: ${dbfs.toFixed(2)} dBFS`);
                    return currentlyAbove;
                }
                return prev;
            });

            // Continue the loop ONLY if still monitoring
            if (isMonitoring) {
                animationFrameRef.current = requestAnimationFrame(analyseAudio);
            } else {
                 animationFrameRef.current = null; // Explicitly nullify if monitoring stopped
            }
        } catch (error) {
             console.error("Error during audio analysis:", error);
             // Optionally stop monitoring on analysis error?
             // stopAudioMonitoring();
             animationFrameRef.current = null; // Stop loop on error
        }
    }, [isMonitoring]); // Depends on isMonitoring to know whether to continue loop


    // --- Stop Audio Monitoring Function ---
    const stopAudioMonitoring = useCallback(() => {
        // Prevent multiple stop calls interfering
        if (processingRef.current && !isMonitoring) return; // Avoid stopping if already stopped/stopping
        processingRef.current = true;
        console.log("<<< Stopping Audio Monitoring >>>");

        if (animationFrameRef.current) {
            cancelAnimationFrame(animationFrameRef.current);
            animationFrameRef.current = null;
            console.log("   Cancelled animation frame");
        }
        if (mediaStreamSourceRef.current) {
            try { mediaStreamSourceRef.current.disconnect(); } catch (e) { console.warn("   Error disconnecting source:", e.message); }
            mediaStreamSourceRef.current = null;
            console.log("   Disconnected media stream source");
        }
        if (analyserRef.current) {
            // No explicit disconnect needed if source is disconnected
            analyserRef.current = null;
            console.log("   Cleared analyser node reference");
        }
        if (audioStreamRef.current) {
            audioStreamRef.current.getTracks().forEach(track => {
                track.stop();
                console.log(`   Stopped audio track: ${track.kind}, state: ${track.readyState}`);
            });
            audioStreamRef.current = null;
            console.log("   Cleared audio stream reference");
        }
        if (audioContextRef.current) {
            if (audioContextRef.current.state !== 'closed') {
                audioContextRef.current.close().then(() => {
                    console.log("   Closed AudioContext");
                }).catch(err => console.error("   Error closing AudioContext:", err))
                .finally(() => {
                    audioContextRef.current = null; // Ensure ref is cleared even if close fails
                });
            } else {
                console.log("   AudioContext already closed.");
                audioContextRef.current = null; // Ensure ref is cleared
            }
        } else {
             console.log("   AudioContext was null.");
        }

        // Reset state *after* cleanup attempts
        setIsAboveThreshold(false);
        setCurrentDecibels(-Infinity);
        setIsMonitoring(false); // Mark as not monitoring
        // Keep audioError unless explicitly cleared elsewhere
        console.log("   Audio monitoring state reset.");
        processingRef.current = false; // Finished processing stop
    }, []); // No dependencies needed


    // --- Start Audio Monitoring Function ---
    const startAudioMonitoring = useCallback(async () => {
        // Prevent starting if already monitoring or currently processing start/stop
        if (isMonitoring || processingRef.current) {
            console.log(`startAudioMonitoring: Aborting. isMonitoring=${isMonitoring}, processing=${processingRef.current}`);
            return;
        }
        // Double check refs - should be cleared by stop if called correctly
        if (audioContextRef.current || audioStreamRef.current) {
             console.warn("startAudioMonitoring: Refs not null, potential race condition or incomplete stop. Aborting.");
             // Attempt cleanup again just in case
             stopAudioMonitoring();
             return;
        }

        processingRef.current = true; // Mark as processing start
        console.log(">>> Starting Audio Monitoring >>>");
        setAudioError(null); // Clear previous errors

        try {
            console.log("   Requesting microphone access...");
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });

            // Check if component unmounted or isActive changed *during* the await
            if (!processingRef.current) { // Check processing flag which would be false if stop was called
                 console.log("startAudioMonitoring: Became inactive during getUserMedia. Stopping tracks.");
                 stream.getTracks().forEach(track => track.stop());
                 processingRef.current = false; // Ensure flag is false
                 return; // Abort setup
            }

            audioStreamRef.current = stream;
            console.log("   Microphone access granted, stream ID:", stream.id);

            const context = new (window.AudioContext || window.webkitAudioContext)();
            audioContextRef.current = context;
            console.log("   AudioContext created, state:", context.state);

            context.onstatechange = () => {
                console.log("AudioContext state changed to:", context.state);
                if (context.state !== 'running' && isMonitoring) {
                    console.warn("AudioContext state is not 'running'. Stopping monitoring.");
                    setAudioError("Audio processing was interrupted.");
                    stopAudioMonitoring(); // Trigger cleanup
                }
            };

            const analyser = context.createAnalyser();
            analyser.smoothingTimeConstant = SMOOTHING_TIME_CONSTANT;
            analyser.fftSize = FFT_SIZE;
            analyserRef.current = analyser;
            console.log("   AnalyserNode created");

            dataArrayRef.current = new Uint8Array(analyser.frequencyBinCount);
            console.log("   Data array allocated, size:", analyser.frequencyBinCount);

            const source = context.createMediaStreamSource(stream);
            mediaStreamSourceRef.current = source;
            console.log("   MediaStreamSource created");

            source.connect(analyser);
            console.log("   Connected source to analyser");

            setIsMonitoring(true); // Set monitoring state TRUE
            console.log("   Starting analysis loop...");
            // Start loop only if monitoring is true (should be)
            console.log("   Starting analysis loop... is Monitoring" + isMonitoring);
            // if (isMonitoring) { // Check state just before starting loop
            //     console.log("Hello from inside the loop!");
            //     animationFrameRef.current = requestAnimationFrame(analyseAudio);
            // }

        } catch (err) {
            console.error("   Error starting audio monitoring:", err.name, err.message);
            let userMessage = "Could not start microphone monitoring.";
            if (err.name === "NotAllowedError" || err.name === "PermissionDeniedError") {
                userMessage = "Microphone permission denied. Please allow microphone access.";
            } else if (err.name === "NotFoundError") {
                userMessage = "No microphone found.";
            } else if (err.name === "NotReadableError") {
                userMessage = "Microphone is already in use or hardware error.";
            }
            setAudioError(userMessage);
            setIsMonitoring(false); // Ensure monitoring is false on error
            // Attempt cleanup even if setup failed midway
            stopAudioMonitoring(); // Call cleanup on error
        } finally {
             processingRef.current = false; // Finished processing start/failure
        }
    // Dependencies: analyseAudio (stable), stopAudioMonitoring (stable)
    // isMonitoring is checked internally, not needed as dep
    }, [analyseAudio, stopAudioMonitoring]);


    // --- Main Effect to Control Monitoring based on isActive ---
    useEffect(() => {
        console.log(`Audio Hook Effect: isActive=${isActive}, Current isMonitoring=${isMonitoring}`);

        if (isActive) {
            // --- Start Setup ---
            // Initiate the setup process only if not already monitoring and not currently processing
            if (!isMonitoring && !processingRef.current && !audioContextRef.current) {
                 console.log("Audio Hook Effect: Conditions met. Calling startAudioMonitoring.");
                 startAudioMonitoring(); // This will set up context and eventually set isMonitoring=true
            }
            // --- Start Analysis Loop ---
            // Once setup is done (isMonitoring is true) and the loop isn't already running
            else if (isMonitoring && !animationFrameRef.current) {
                 console.log("Audio Hook Effect: isMonitoring is TRUE and loop not running. Starting analysis loop.");
                 // Ensure analyser is ready before starting loop (should be if isMonitoring is true)
                 if (analyserRef.current && dataArrayRef.current) {
                    animationFrameRef.current = requestAnimationFrame(analyseAudio);
                 } else {
                    console.warn("Audio Hook Effect: isMonitoring true, but analyser/dataArray not ready. Cannot start loop yet.");
                 }
            } else {
                 console.log(`Audio Hook Effect: Skipping start/loop logic (isMonitoring=${isMonitoring}, processing=${processingRef.current}, frameRunning=${!!animationFrameRef.current})`);
            }
        } else {
            // --- Stop Monitoring ---
            // Stop only if IS currently monitoring AND NOT currently processing stop
            // stopAudioMonitoring handles cancelling the animation frame internally
            if (isMonitoring && !processingRef.current) {
                console.log("Audio Hook Effect: isActive is FALSE. Calling stopAudioMonitoring.");
                stopAudioMonitoring();
            } else {
                 console.log(`Audio Hook Effect: Skipping stop (isMonitoring=${isMonitoring}, processing=${processingRef.current})`);
            }
        }

        // Cleanup function: Runs when isActive changes OR component unmounts
        // Cleanup function: Runs when isActive changes, isMonitoring changes, OR component unmounts
        return () => {
            console.log(`Cleanup effect in useAudioDetection triggered (isActive was ${isActive}, isMonitoring was ${isMonitoring}).`);
            // Always cancel any pending frame on cleanup
            if (animationFrameRef.current) {
                cancelAnimationFrame(animationFrameRef.current);
                animationFrameRef.current = null;
                console.log("Cleanup: Cancelled animation frame.");
            }
            // We only need to fully stop the audio context etc. if it was actually running
            // Check state directly here - stopAudioMonitoring handles internal checks too
            if (isMonitoring) {
                 console.log("Cleanup: isMonitoring is true, calling stopAudioMonitoring to ensure full cleanup.");
                 // Call stopAudioMonitoring to ensure tracks/context are released
                 // It has internal checks to prevent redundant work.
                 stopAudioMonitoring();
            } else {
                 console.log("Cleanup: isMonitoring is false, skipping stop call.");
            }
        };
    // Dependencies: 'isActive' triggers the intent. 'isMonitoring' triggers starting the loop *after* setup.
    // analyseAudio, startAudioMonitoring, stopAudioMonitoring are stable callbacks.
    }, [isActive, isMonitoring, analyseAudio, startAudioMonitoring, stopAudioMonitoring]); // <-- CRITICAL: Only depend on isActive

    return { isAboveThreshold, currentDecibels, audioError, isMonitoring };
};
