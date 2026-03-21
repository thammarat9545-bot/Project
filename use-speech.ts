import { useState, useEffect, useCallback, useRef } from 'react';

// Type definitions สำหรับ Web Speech API
interface SpeechRecognitionEvent extends Event {
  results: SpeechRecognitionResultList;
  resultIndex: number;
}
interface SpeechRecognitionErrorEvent extends Event {
  error: SpeechErrorCode;
  message: string;
}
type SpeechErrorCode =
  | 'no-speech' | 'audio-capture' | 'not-allowed' | 'network'
  | 'aborted' | 'language-not-supported' | 'service-not-allowed' | 'bad-grammar';

declare global {
  interface Window {
    SpeechRecognition: any;
    webkitSpeechRecognition: any;
  }
}

// ตรวจสอบ compatibility ของ browser
export interface SpeechCompatibility {
  isApiSupported: boolean;
  isSecureContext: boolean;
  browserName: string;
  isRecommendedBrowser: boolean;
}

function detectBrowser(): string {
  const ua = navigator.userAgent;
  if (ua.includes('Edg/')) return 'Edge';
  if (ua.includes('Chrome/')) return 'Chrome';
  if (ua.includes('Safari/') && !ua.includes('Chrome')) return 'Safari';
  if (ua.includes('Firefox/')) return 'Firefox';
  return 'Unknown';
}

export function checkSpeechCompatibility(): SpeechCompatibility {
  const isApiSupported = !!(
    typeof window !== 'undefined' &&
    (window.SpeechRecognition || window.webkitSpeechRecognition)
  );
  const isSecureContext =
    typeof window !== 'undefined' &&
    (window.isSecureContext ||
      location.hostname === 'localhost' ||
      location.hostname === '127.0.0.1');
  const browserName = detectBrowser();
  const isRecommendedBrowser = browserName === 'Chrome' || browserName === 'Edge';
  return { isApiSupported, isSecureContext, browserName, isRecommendedBrowser };
}

// แปลง error code → ข้อความภาษาไทย
function mapErrorToThai(errorCode: SpeechErrorCode | string): string {
  switch (errorCode) {
    case 'not-allowed':
      return 'ไม่ได้รับอนุญาตใช้ไมโครโฟน กรุณาคลิกไอคอนกุญแจใน URL bar แล้วอนุญาต จากนั้น refresh';
    case 'audio-capture':
      return 'ไม่พบไมโครโฟน กรุณาตรวจสอบว่าเชื่อมต่อไมโครโฟนและไม่ได้ถูกใช้โดยโปรแกรมอื่น';
    case 'network':
      return 'ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์รู้จำเสียงได้ กรุณาตรวจสอบอินเทอร์เน็ต';
    case 'no-speech':
      return 'ไม่ได้ยินเสียง กรุณาพูดใกล้ไมโครโฟนมากขึ้น';
    case 'aborted':
      return 'การรู้จำเสียงถูกยกเลิก';
    case 'language-not-supported':
      return 'ภาษาไทย (th-TH) ไม่รองรับในเบราว์เซอร์นี้ กรุณาใช้ Chrome หรือ Edge';
    case 'service-not-allowed':
      return 'บริการรู้จำเสียงไม่อนุญาต อาจเกิดจากเว็บไม่ได้ใช้ HTTPS';
    default:
      return `เกิดข้อผิดพลาด: ${errorCode}`;
  }
}

export function useSpeechToText() {
  const [isRecording, setIsRecording] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [interimTranscript, setInterimTranscript] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [permissionState, setPermissionState] = useState<
    'unknown' | 'granted' | 'denied' | 'prompt'
  >('unknown');

  const recognitionRef = useRef<any>(null);
  const isRecordingRef = useRef(false);     // ป้องกัน stale state ใน closure
  const shouldRestartRef = useRef(false);   // ควบคุม auto-restart

  const compat = checkSpeechCompatibility();

  // ตรวจสอบ microphone permission ผ่าน Permissions API
  useEffect(() => {
    if (!navigator.permissions) return;
    navigator.permissions
      .query({ name: 'microphone' as PermissionName })
      .then((result) => {
        setPermissionState(result.state as any);
        result.onchange = () => setPermissionState(result.state as any);
      })
      .catch(() => setPermissionState('unknown'));
  }, []);

  // สร้าง SpeechRecognition instance ครั้งเดียว (ไม่ขึ้นกับ state)
  useEffect(() => {
    if (!compat.isApiSupported) return;

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    const recognition = new SpeechRecognition();
    recognition.continuous = true;       // อัดเสียงต่อเนื่อง
    recognition.interimResults = true;   // แสดงข้อความขณะพูด
    recognition.lang = 'th-TH';          // ภาษาไทย
    recognition.maxAlternatives = 1;

    recognition.onstart = () => {
      setIsRecording(true);
      setError(null);
    };

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      let finalChunk = '';
      let interimChunk = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        const text = result[0].transcript;
        if (result.isFinal) finalChunk += text + ' ';
        else interimChunk += text;
      }
      if (finalChunk) setTranscript((prev) => prev + finalChunk);
      setInterimTranscript(interimChunk);
    };

    recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
      const code = event.error;
      // no-speech และ aborted ไม่ใช่ error จริง
      if (code === 'no-speech' || code === 'aborted') return;

      shouldRestartRef.current = false;
      isRecordingRef.current = false;
      setIsRecording(false);
      setInterimTranscript('');
      setError(mapErrorToThai(code));
      if (code === 'not-allowed') setPermissionState('denied');
    };

    recognition.onend = () => {
      setInterimTranscript('');
      // auto-restart ถ้ายังอยู่ในโหมด recording
      if (shouldRestartRef.current && isRecordingRef.current) {
        try {
          recognition.start();
        } catch {
          isRecordingRef.current = false;
          shouldRestartRef.current = false;
          setIsRecording(false);
        }
      } else {
        isRecordingRef.current = false;
        setIsRecording(false);
      }
    };

    recognitionRef.current = recognition;

    return () => {
      shouldRestartRef.current = false;
      isRecordingRef.current = false;
      try { recognition.abort(); } catch { /* ignore */ }
    };
  }, []); // สร้างครั้งเดียว — ไม่มี deps

  // เริ่มอัดเสียง (ขอ permission ก่อนเสมอ)
  const startRecording = useCallback(async () => {
    if (!compat.isApiSupported) {
      setError('เบราว์เซอร์ไม่รองรับ กรุณาใช้ Google Chrome หรือ Microsoft Edge');
      return;
    }
    if (!compat.isSecureContext) {
      setError('ต้องใช้ HTTPS เพื่อเปิดไมโครโฟน');
      return;
    }
    if (isRecordingRef.current) return;

    setError(null);

    // ขอ permission ก่อน เพื่อให้ browser แสดง popup
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach((t) => t.stop()); // ได้ permission แล้ว ปิด stream
      setPermissionState('granted');
    } catch (err: any) {
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        setPermissionState('denied');
        setError(mapErrorToThai('not-allowed'));
      } else if (err.name === 'NotFoundError') {
        setError(mapErrorToThai('audio-capture'));
      } else {
        setError(`ไม่สามารถเข้าถึงไมโครโฟนได้: ${err.message}`);
      }
      return;
    }

    try {
      isRecordingRef.current = true;
      shouldRestartRef.current = true;
      recognitionRef.current?.start();
    } catch (err: any) {
      isRecordingRef.current = false;
      shouldRestartRef.current = false;
      if (err.name !== 'InvalidStateError') {
        setError(`ไม่สามารถเริ่มอัดเสียงได้: ${err.message}`);
      }
    }
  }, [compat.isApiSupported, compat.isSecureContext]);

  // หยุดอัดเสียง
  const stopRecording = useCallback(() => {
    shouldRestartRef.current = false;
    isRecordingRef.current = false;
    setIsRecording(false);
    setInterimTranscript('');
    try { recognitionRef.current?.stop(); } catch { /* ignore */ }
  }, []);

  const toggleRecording = useCallback(() => {
    if (isRecordingRef.current) stopRecording();
    else startRecording();
  }, [startRecording, stopRecording]);

  const clearTranscript = useCallback(() => {
    setTranscript('');
    setInterimTranscript('');
  }, []);

  const clearError = useCallback(() => setError(null), []);

  return {
    isRecording, transcript, interimTranscript,
    fullTranscript: transcript + interimTranscript,
    error, permissionState,
    startRecording, stopRecording, toggleRecording,
    clearTranscript, clearError,
    isSupported: compat.isApiSupported,
    isSecureContext: compat.isSecureContext,
    browserName: compat.browserName,
    isRecommendedBrowser: compat.isRecommendedBrowser,
    compatibility: compat,
  };
}
