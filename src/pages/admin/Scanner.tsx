import { useEffect, useRef, useState } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import { Link } from 'react-router-dom';
import { db } from '../../lib/db';
import { supabase, isMock } from '../../lib/supabase';
import { ArrowLeft, RefreshCw, CheckCircle, AlertCircle, Ticket, AlertTriangle, User, CalendarDays } from 'lucide-react';
import { useLiveQuery } from 'dexie-react-hooks';

type LiveEvent = {
  id: number;
  title: string;
  start_at: string;
  is_cancelled?: boolean;
};

type EventScanStatus = {
  status: 'NOT_REGISTERED' | 'APPLY' | 'CHECKED_IN' | 'CANCELLED' | 'ERROR';
  message?: string;
};

export const Scanner = () => {
  const [scanResult, setScanResult] = useState<{id: string, ts: number, action?: string, designId?: number, ticketId?: number, isOld?: boolean, userName?: string} | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const isScanningRef = useRef(false);
  const [scanMode, setScanMode] = useState<'points' | 'event'>('points');
  const [events, setEvents] = useState<LiveEvent[]>([]);
  const [selectedEventId, setSelectedEventId] = useState<number | null>(null);
  const [eventStatus, setEventStatus] = useState<EventScanStatus | null>(null);
  const [isCheckingEvent, setIsCheckingEvent] = useState(false);

  // Get current admin group context
  const [groupId] = useState<number>(() => {
      const saved = localStorage.getItem('admin_selected_group_id');
      return saved ? parseInt(saved) : 1;
  });
  
  // Fetch group info
  const group = useLiveQuery(() => db.groups.get(groupId));

  // Fetch available designs for manual grant (Scoped to Group)
  const designs = useLiveQuery(() => 
    db.cardDesigns.where('groupId').equals(groupId).toArray()
  , [groupId]);

  useEffect(() => {
    // Initialize scanner
    const initScanner = async () => {
      if (isScanningRef.current) return;
      
      try {
        const devices = await Html5Qrcode.getCameras();
        if (devices && devices.length) {
           // Prefer back camera
           const cameraId = devices.find(d => d.label.toLowerCase().includes('back'))?.id || devices[0].id;
           
           const html5QrCode = new Html5Qrcode("reader");
           scannerRef.current = html5QrCode;
           
           await html5QrCode.start(
             cameraId, 
             {
               fps: 10,
               qrbox: { width: 250, height: 250 },
             },
             (decodedText) => {
                handleScan(decodedText);
             },
             () => {
               // ignore frame errors
             }
           );
           isScanningRef.current = true;
        } else {
          setError("カメラが見つかりませんでした");
        }
      } catch (err) {
        console.error("Camera start error", err);
        setError("カメラの起動に失敗しました");
      }
    };

    initScanner();

    return () => {
      if (scannerRef.current && isScanningRef.current) {
        scannerRef.current.stop().then(() => {
          scannerRef.current?.clear();
          isScanningRef.current = false;
        }).catch(err => console.warn("Stop failed", err));
      }
    };
  }, []);

  useEffect(() => {
    const loadEvents = async () => {
      if (isMock) {
        setEvents([]);
        return;
      }

      const { data, error } = await supabase
        .from('live_events')
        .select('id, title, start_at, is_cancelled')
        .eq('group_id', groupId)
        .order('start_at', { ascending: true });

      if (error) {
        console.error('Failed to fetch live events', error);
        return;
      }

      const fetched = (data || []) as LiveEvent[];
      setEvents(fetched);
      if (!selectedEventId && fetched.length > 0) {
        setSelectedEventId(fetched[0].id);
      }
    };

    loadEvents();
  }, [groupId]);

  const handleScan = (text: string) => {
    try {
      // Decode Base64
      const json = JSON.parse(atob(text));
      const { id, ts, userId, name: encodedName } = json; // support both 'id' (points) and 'userId' (ticket)
      
      const targetId = id || userId;
      const userName = encodedName ? decodeURIComponent(encodedName) : undefined;

      if (!targetId || !ts) throw new Error("Invalid Format");
      
      const now = Date.now();
      const age = now - ts;
      
      // Allow old QRs (screenshots)
      let isOld = false;
      if (age > 180000) {
         isOld = true;
      }
      
      if (age < -60000) { 
         setError("不正なタイムスタンプです(未来時刻)");
         pauseScanner();
         return;
      }
      
      setScanResult({ ...json, id: targetId, isOld, userName });
      setError(null);
      pauseScanner();
      
      if (navigator.vibrate) navigator.vibrate([100, 50, 100]);
      
      // Check membership existence for this group
      // Note: We don't block scanning if not member, but we should probably init membership on grant
      
    } catch (e) {
      // console.log("Scan ignored:", text);
    }
  };
  
  const pauseScanner = () => {
    if (scannerRef.current && isScanningRef.current) {
      scannerRef.current.pause();
    }
  };
  
  const resumeScanner = () => {
    setScanResult(null);
    setError(null);
    setSuccessMsg(null);
    setEventStatus(null);
    if (scannerRef.current) {
      scannerRef.current.resume();
    }
  };

  useEffect(() => {
    const checkEventRegistration = async () => {
      if (scanMode !== 'event' || !scanResult?.id) {
        setEventStatus(null);
        return;
      }

      if (!selectedEventId) {
        setEventStatus({ status: 'ERROR', message: 'ライブを選択してください' });
        return;
      }

      if (isMock) {
        setEventStatus({ status: 'NOT_REGISTERED' });
        return;
      }

      setIsCheckingEvent(true);
      const { data, error } = await supabase
        .from('live_event_registrations')
        .select('*')
        .eq('event_id', selectedEventId)
        .eq('user_id', scanResult.id);

      setIsCheckingEvent(false);

      if (error) {
        console.error('Failed to check registration', error);
        setEventStatus({ status: 'ERROR', message: '参加状況の取得に失敗しました' });
        return;
      }

      const registration = data && data.length > 0 ? data[0] : null;
      if (!registration) {
        setEventStatus({ status: 'NOT_REGISTERED' });
        return;
      }

      setEventStatus({ status: registration.status });
    };

    checkEventRegistration();
  }, [scanMode, scanResult, selectedEventId]);

  const grantPoints = async (points: number) => {
    if (!scanResult) return;
    
    try {
      // Add to pending sync
      await db.pendingScans.add({
        userId: scanResult.id,
        groupId: groupId,
        points: points,
        type: 'GRANT',
        timestamp: Date.now(),
        synced: false
      });

      // Update local cache for simulation (Scoped to Group)
      // Find existing membership or create one
      const membership = await db.userMemberships.where({ userId: scanResult.id, groupId }).first();
      
      if (membership) {
        await db.userMemberships.update(membership.id!, {
            points: membership.points + points,
            totalPoints: membership.totalPoints + points,
            lastUpdated: Date.now()
        });
      } else {
          // Create new membership if first time
          await db.userMemberships.add({
              userId: scanResult.id,
              groupId: groupId,
              points: points,
              totalPoints: points,
              currentRank: 'REGULAR',
              lastUpdated: Date.now()
          });
      }
      
      setSuccessMsg(`${scanResult.id} に ${points}pt 付与しました`);
      if (navigator.vibrate) navigator.vibrate(200);
      
    } catch (err) {
      console.error(err);
      setError("データベースへの保存に失敗しました");
    }
  };

  const grantDesign = async (designId: number) => {
    if (!scanResult) return;

    try {
      // 1. Add user owned design (Scoped to Group) - Local DB
      await db.userDesigns.add({
        userId: scanResult.id,
        groupId: groupId,
        designId: designId,
        acquiredAt: Date.now()
      });

      // 2. Sync to Supabase IMMEDIATELY (Online only)
      let isSynced = false;
      if (!isMock) {
          const { error } = await supabase.from('user_designs').insert({
              user_id: scanResult.id,
              group_id: groupId,
              design_id: designId,
              acquired_at: new Date().toISOString()
          });
          
          if (error) {
              console.error("Failed to sync design grant to Supabase", error);
              // Fallback to offline sync (isSynced remains false)
          } else {
              isSynced = true;
          }
      }

      // 3. Log transaction
      await db.pendingScans.add({
        userId: scanResult.id,
        groupId: groupId,
        points: 0,
        type: 'GRANT_DESIGN',
        designId: designId,
        timestamp: Date.now(),
        synced: isSynced
      });


      const designName = designs?.find(d => d.id === designId)?.name;
      setSuccessMsg(`デザイン「${designName}」を付与しました`);
      if (navigator.vibrate) navigator.vibrate(200);

    } catch (err) {
      console.error(err);
      setError("デザインの付与に失敗しました");
    }
  };

  const useTicket = async () => {
    if (!scanResult?.ticketId) return;

    try {
      // Mark ticket as used in local DB
      // Ideally we should check if ticket belongs to this group, but ID is unique enough usually.
      // But for safety let's just update by ID.
      await db.userTickets.update(scanResult.ticketId, { status: 'USED', usedAt: Date.now() });
      
      // Log transaction
      await db.pendingScans.add({
        userId: scanResult.id,
        groupId: groupId,
        points: 0,
        type: 'USE_TICKET',
        ticketId: scanResult.ticketId.toString(),
        timestamp: Date.now(),
        synced: false
      });

      setSuccessMsg("チケットを使用済みにしました");
      if (navigator.vibrate) navigator.vibrate(200);
    } catch (err) {
        console.error(err);
        setError("チケットの処理に失敗しました");
    }
  };

  const checkInEvent = async () => {
    if (!scanResult?.id || !selectedEventId) return;
    if (eventStatus?.status !== 'APPLY') {
      setError('参加登録がないため、来場確認できません');
      return;
    }

    try {
      if (isMock) {
        setSuccessMsg('来場確認を完了しました');
        return;
      }

      const { error } = await supabase
        .from('live_event_registrations')
        .update({
          status: 'CHECKED_IN',
          checked_in_at: new Date().toISOString()
        })
        .eq('event_id', selectedEventId)
        .eq('user_id', scanResult.id);

      if (error) throw error;

      setEventStatus({ status: 'CHECKED_IN' });
      setSuccessMsg('来場確認を完了しました');
    } catch (err) {
      console.error(err);
      setError('来場確認に失敗しました');
    }
  };

  return (
    <div className="min-h-[100dvh] bg-black text-white flex flex-col font-sans">
      <header className="p-4 flex items-center justify-between bg-black/50 backdrop-blur-md absolute top-0 left-0 right-0 z-30">
        <Link to="/admin/dashboard" className="p-2 bg-white/10 rounded-full backdrop-blur-md">
          <ArrowLeft size={20} />
        </Link>
        <h1 className="text-sm font-bold tracking-wider opacity-80">SCANNER ({group?.name})</h1>
        <div className="w-10"></div> {/* Spacer */}
      </header>

      <div className="flex-1 flex flex-col relative overflow-hidden bg-black">
        <style>{`
          #reader {
            width: 100%;
            height: 100%;
            overflow: hidden;
            position: absolute !important;
            inset: 0;
            z-index: 0;
          }
          #reader video,
          #reader canvas {
            width: 100% !important;
            height: 100% !important;
            object-fit: cover !important;
          }
        `}</style>
        {/* Mode Toggle */}
        <div className="absolute top-16 left-0 right-0 z-20 px-4">
          <div className="bg-black/50 backdrop-blur-md rounded-full p-1 flex gap-2 text-sm font-bold">
            <button
              onClick={() => setScanMode('points')}
              className={`flex-1 py-2 rounded-full transition ${scanMode === 'points' ? 'bg-white text-gray-900' : 'text-white/70 hover:text-white'}`}
            >
              ポイント
            </button>
            <button
              onClick={() => setScanMode('event')}
              className={`flex-1 py-2 rounded-full transition ${scanMode === 'event' ? 'bg-white text-gray-900' : 'text-white/70 hover:text-white'}`}
            >
              ライブ
            </button>
          </div>

          {scanMode === 'event' && (
            <div className="mt-3 bg-black/50 backdrop-blur-md rounded-2xl px-4 py-3">
              <div className="text-xs text-white/70 font-bold mb-2 flex items-center gap-2">
                <CalendarDays size={14} /> 対象ライブ
              </div>
              <select
                value={selectedEventId ?? ''}
                onChange={(e) => setSelectedEventId(e.target.value ? parseInt(e.target.value) : null)}
                className="w-full bg-white/10 text-white font-bold text-sm py-2 px-3 rounded-xl focus:outline-none"
              >
                <option value="">ライブを選択</option>
                {events.map(event => (
                  <option key={event.id} value={event.id}>
                    {event.is_cancelled ? '【中止】' : ''}{event.title} ({new Date(event.start_at).toLocaleDateString('ja-JP')})
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        {/* Camera View */}
        <div id="reader" className={`w-full h-full bg-black ${scanResult || error ? 'hidden' : 'block'}`}></div>
        
        {!scanResult && !error && !successMsg && (
          <div className="absolute inset-0 pointer-events-none flex items-center justify-center z-10">
             <div className="w-64 h-64 border-2 border-primary/50 rounded-3xl relative">
                <div className="absolute top-0 left-0 w-6 h-6 border-t-4 border-l-4 border-primary rounded-tl-xl"></div>
                <div className="absolute top-0 right-0 w-6 h-6 border-t-4 border-r-4 border-primary rounded-tr-xl"></div>
                <div className="absolute bottom-0 left-0 w-6 h-6 border-b-4 border-l-4 border-primary rounded-bl-xl"></div>
                <div className="absolute bottom-0 right-0 w-6 h-6 border-b-4 border-r-4 border-primary rounded-br-xl"></div>
                <div className="absolute inset-0 bg-primary/5 animate-pulse rounded-3xl"></div>
             </div>
             <div className="absolute bottom-20 flex flex-col items-center">
                <p className="text-white/70 text-sm font-medium bg-black/40 px-4 py-2 rounded-full backdrop-blur-sm mb-2">
                枠内にQRコードを合わせてください
                </p>
                <p className="text-primary text-xs font-bold bg-white/10 px-3 py-1 rounded-full">
                    Current Group: {group?.name}
                </p>
             </div>
          </div>
        )}
        
        {/* Overlays */}
        {(scanResult || error || successMsg) && (
           <div className="absolute inset-0 z-20 bg-black/80 backdrop-blur-sm flex flex-col items-center justify-center p-6 animate-fade-in">
              
              {error && (
                <div className="bg-white text-red-600 p-8 rounded-3xl text-center shadow-2xl max-w-xs w-full animate-slide-up">
                  <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <AlertCircle size={32} className="text-red-500" />
                  </div>
                  <h2 className="text-xl font-bold mb-2">読み取りエラー</h2>
                  <p className="text-sm text-gray-600 mb-6">{error}</p>
                  <button onClick={resumeScanner} className="w-full bg-red-500 text-white py-3.5 rounded-xl font-bold shadow-lg shadow-red-500/30 hover:bg-red-600 transition">
                    再試行
                  </button>
                </div>
              )}

              {successMsg && (
                <div className="bg-white text-green-800 p-8 rounded-3xl text-center shadow-2xl max-w-xs w-full animate-slide-up">
                  <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <CheckCircle size={32} className="text-green-500" />
                  </div>
                  <h2 className="text-xl font-bold mb-2 text-gray-800">完了</h2>
                  <p className="text-sm text-gray-600 mb-6">{successMsg}</p>
                  <button onClick={resumeScanner} className="w-full bg-green-500 text-white py-3.5 rounded-xl font-bold shadow-lg shadow-green-500/30 hover:bg-green-600 transition flex items-center justify-center gap-2">
                    <RefreshCw size={18} /> 次をスキャン
                  </button>
                </div>
              )}

              {scanResult && !successMsg && !error && (
                <div className="bg-white text-gray-800 p-6 rounded-3xl shadow-2xl w-full max-w-sm animate-slide-up max-h-[80vh] overflow-y-auto">
                  <div className="text-center mb-6 border-b border-gray-100 pb-4">
                    {scanResult.isOld && (
                      <div className="flex items-center justify-center gap-1 text-amber-500 text-xs font-bold mb-2 bg-amber-50 py-1 rounded-full w-fit mx-auto px-3">
                        <AlertTriangle size={12} />
                        <span>古いQR (スクショの可能性あり)</span>
                      </div>
                    )}
                    <p className="text-xs text-gray-400 font-bold uppercase tracking-wider mb-1">User Detected</p>
                    <p className="text-xl font-bold text-gray-900 truncate px-4 flex items-center justify-center gap-2">
                        <User size={20} className="text-primary" />
                        {scanResult.userName || <span className="text-base font-mono">{scanResult.id.substring(0, 8)}...</span>}
                    </p>
                    {scanResult.userName && <p className="text-xs font-mono text-gray-400 mt-1">{scanResult.id}</p>}
                  </div>
                  
                  {/* Action: Event Check-in */}
                  {scanMode === 'event' ? (
                    <div className="text-center">
                      <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">ライブ参加確認</p>
                      <div className="bg-blue-50 p-4 rounded-xl mb-4">
                        <CalendarDays size={32} className="text-blue-600 mx-auto mb-2" />
                        {eventStatus?.status === 'ERROR' && (
                          <p className="text-xs text-red-500 font-bold">{eventStatus.message}</p>
                        )}
                        {isCheckingEvent && (
                          <p className="text-xs text-gray-500 font-bold">参加状況を確認中...</p>
                        )}
                        {!isCheckingEvent && eventStatus?.status === 'NOT_REGISTERED' && (
                          <p className="text-xs text-gray-500 font-bold">参加登録がありません</p>
                        )}
                        {!isCheckingEvent && eventStatus?.status === 'APPLY' && (
                          <p className="text-xs text-blue-600 font-bold">参加予定</p>
                        )}
                        {!isCheckingEvent && eventStatus?.status === 'CHECKED_IN' && (
                          <p className="text-xs text-green-600 font-bold">来場済み</p>
                        )}
                        {!isCheckingEvent && eventStatus?.status === 'CANCELLED' && (
                          <p className="text-xs text-gray-400 font-bold">参加取消</p>
                        )}
                      </div>

                      <button
                        onClick={checkInEvent}
                        disabled={eventStatus?.status !== 'APPLY'}
                        className="w-full bg-blue-600 hover:bg-blue-700 text-white py-4 rounded-xl font-bold shadow-lg transition disabled:opacity-60 disabled:cursor-not-allowed"
                      >
                        来場確認する
                      </button>
                    </div>
                  ) : scanResult.action === 'USE_TICKET' ? (
                     <div className="text-center">
                        <div className="bg-green-50 p-4 rounded-xl mb-4">
                          <Ticket size={32} className="text-green-600 mx-auto mb-2" />
                          <p className="font-bold text-green-800">チケット使用</p>
                          <p className="text-xs text-green-600">ID: {scanResult.ticketId}</p>
                        </div>
                        <button 
                          onClick={useTicket}
                          className="w-full bg-green-600 hover:bg-green-700 text-white py-4 rounded-xl font-bold shadow-lg transition"
                        >
                          使用済みにする
                        </button>
                     </div>
                  ) : (
                    <>
                      {/* Action: Grant Points */}
                      <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">ポイント付与 ({group?.name})</p>
                      <div className="grid grid-cols-2 gap-3 mb-6">
                        <button 
                          onClick={() => grantPoints(1)}
                          className="bg-blue-50 text-blue-600 hover:bg-blue-100 py-4 rounded-xl font-bold shadow-sm transition flex flex-col items-center justify-center"
                        >
                          <span className="text-xl">+1</span>
                          <span className="text-[10px]">通常</span>
                        </button>
                        <button 
                          onClick={() => grantPoints(5)}
                          className="bg-purple-50 text-purple-600 hover:bg-purple-100 py-4 rounded-xl font-bold shadow-sm transition flex flex-col items-center justify-center"
                        >
                          <span className="text-xl">+5</span>
                          <span className="text-[10px]">特別</span>
                        </button>
                      </div>

                      {/* Action: Grant Design */}
                      {designs && designs.length > 0 && (
                        <>
                          <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">デザイン付与</p>
                          <div className="grid grid-cols-2 gap-3 mb-6">
                            {designs.map(design => (
                              <button
                                key={design.id}
                                onClick={() => grantDesign(design.id!)}
                                className="relative h-16 rounded-xl border-2 border-gray-100 overflow-hidden hover:border-primary transition group"
                              >
                                <div className="absolute inset-0" style={{ background: design.imageUrl }}></div>
                                <div className="absolute inset-0 bg-black/30 group-hover:bg-black/10 transition flex items-center justify-center">
                                  <span className="text-white font-bold text-xs drop-shadow-md">{design.name}</span>
                                </div>
                              </button>
                            ))}
                          </div>
                        </>
                      )}
                    </>
                  )}
                  
                  <button onClick={resumeScanner} className="w-full py-3 text-gray-400 text-sm font-bold hover:text-gray-600 transition mt-2">
                    キャンセル
                  </button>
                </div>
              )}
           </div>
        )}
      </div>
    </div>
  );
};