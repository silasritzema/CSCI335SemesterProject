import { useEffect, useRef, useState } from 'react';

export default function WebcamComponent() {
  const videoRef = useRef(null);
  const [isOn, setIsOn] = useState(false);
  const [error, setError] = useState(null);
  const streamRef = useRef(null);

  const startWebcam = async () => {
    try {
      setError(null);
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { width: { ideal: 320 }, height: { ideal: 240 } } 
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
      setIsOn(true);
    } catch (err) {
      setError(err.message || 'Failed to access webcam');
      setIsOn(false);
    }
  };

  const stopWebcam = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    setIsOn(false);
  };

  useEffect(() => {
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

  return (
    <div className="flex flex-col gap-2 bg-base-100 p-3 rounded border border-base-content/10 w-80">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-sm">Webcam</h3>
        <button
          className={`btn btn-sm ${isOn ? 'btn-error' : 'btn-success'}`}
          onClick={isOn ? stopWebcam : startWebcam}
        >
          {isOn ? 'Stop' : 'Start'}
        </button>
      </div>

      {error && (
        <div className="alert alert-error py-2">
          <span className="text-xs">{error}</span>
        </div>
      )}

      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        className={`w-full rounded bg-base-300 ${isOn ? '' : 'opacity-30'}`}
        style={{ transform: 'scaleX(-1)' }} //mirrored display 
      />
    </div>
  );
}
