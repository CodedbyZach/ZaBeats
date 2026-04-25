import React, { useState, useEffect, useRef, useMemo } from 'react';
import * as Tone from 'tone';
import toWav from 'audiobuffer-to-wav';
import { Play, Square, Activity, Pause, ChevronRight, X, Settings } from 'lucide-react';

const TRACK_NAMES = [
  "KICK", "SNARE", "HAT 1", "HAT 2", "CLAP", "TOM 1", "PERC 1", "PERC 2",
  "SYNTH 1", "SYNTH 2", "BASS 1", "BASS 2", "LEAD", "PAD", "VOX", "FX 1",
  "FX 2", "SUB", "CRASH", "RIDE", "RIM", "SHAKER", "COWBELL", "MASTER"
];

const App = () => {
  const [tracks, setTracks] = useState(
    TRACK_NAMES.reduce((acc, name) => ({ ...acc, [name]: { steps: Array(64).fill(false) } }), {})
  );

  const [isPlaying, setIsPlaying] = useState(false);
  const [activeStep, setActiveStep] = useState(-1);
  const [bpm, setBpm] = useState(140);
  const [activeMenu, setActiveMenu] = useState(null);
  const [showVersion, setShowVersion] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [themeMode, setThemeMode] = useState('dark');
  const [endAction, setEndAction] = useState('stopAtLast');

  const players = useRef({});
  const sequencerLoop = useRef(null);
  const rackRef = useRef(null);

  const themes = {
    light: { app: '#f0f0f0', window: '#e0e0e0', rack: '#ffffff', text: '#000', border: '#aaa' },
    dark: { app: '#1a1a1a', window: '#c0c0c0', rack: '#333333', text: '#000', border: '#444' },
    darkest: { app: '#000', window: '#222', rack: '#111', text: '#00ff41', border: '#00ff41' }
  };
  const currentTheme = themes[themeMode];

  useEffect(() => {
    const el = rackRef.current;
    if (!el) return;
    const handleWheel = (e) => { e.preventDefault(); el.scrollLeft += e.deltaY * 3; };
    el.addEventListener('wheel', handleWheel, { passive: false });
    return () => el.removeEventListener('wheel', handleWheel);
  }, []);

  useEffect(() => {
    TRACK_NAMES.forEach(name => {
      players.current[name] = name.includes("SYNTH") || name.includes("BASS") || name === "LEAD"
        ? new Tone.FMSynth({ volume: -15 }).toDestination()
        : new Tone.MembraneSynth({ volume: -10 }).toDestination();
    });
    Tone.Transport.loop = true;
    Tone.Transport.loopEnd = "4m";
  }, []);

  useEffect(() => { Tone.Transport.bpm.value = bpm; }, [bpm]);

  const lastActiveStep = useMemo(() => {
    let max = -1;
    Object.values(tracks).forEach(t => {
      const idx = t.steps.lastIndexOf(true);
      if (idx > max) max = idx;
    });
    return max;
  }, [tracks]);

  useEffect(() => {
    if (sequencerLoop.current) sequencerLoop.current.dispose();
    sequencerLoop.current = new Tone.Sequence((time, step) => {
      setActiveStep(step);
      if (endAction === 'stopAtLast' && step === lastActiveStep) {
        Tone.Draw.schedule(() => handleStop(), time + Tone.Time("16n"));
      } else if (endAction === 'stop' && step === 63) {
        Tone.Draw.schedule(() => handleStop(), time + Tone.Time("16n"));
      }
      Object.entries(tracks).forEach(([name, data]) => {
        if (data.steps[step]) {
          players.current[name].triggerAttackRelease(name === "KICK" ? "C1" : "G2", "8n", time);
        }
      });
    }, Array.from({ length: 64 }, (_, i) => i), "16n").start(0);
    return () => sequencerLoop.current.dispose();
  }, [tracks, lastActiveStep, endAction]);

  const handleStop = () => {
    Tone.Transport.stop();
    setIsPlaying(false);
    setActiveStep(-1);
  };

  const exportAudio = async (format) => {
    handleStop();
    const duration = (60 / bpm) * 16;
    const buffer = await Tone.Offline(({ transport }) => {
      const offGain = new Tone.Gain(0.7).toDestination();
      Object.entries(tracks).forEach(([name, data]) => {
        const synth = new Tone.MembraneSynth().connect(offGain);
        data.steps.forEach((on, i) => {
          if (on) synth.triggerAttackRelease("C1", "8n", i * Tone.Time("16n"));
        });
      });
      transport.bpm.value = bpm;
      transport.start();
    }, duration);
    const wav = toWav(buffer);
    const blob = new Blob([new DataView(wav)], { type: 'audio/wav' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `ZaBeats_Export.${format}`;
    link.click();
    setActiveMenu(null);
  };

  return (
    <div style={{...styles.desktopContainer, background: currentTheme.app}} onClick={() => setActiveMenu(null)}>
      <div style={{...styles.window, background: currentTheme.window, borderColor: currentTheme.border}}>
        <div style={{...styles.titleBar, background: themeMode === 'darkest' ? '#000' : 'linear-gradient(90deg, #0000aa, #1084d0)'}}>
          <div style={{display:'flex', alignItems:'center', gap:'8px'}}><Activity size={16} /> ZaBeats Studio 1.8.4</div>
        </div>

        <div style={{...styles.menuBar, color: currentTheme.text}}>
          <div style={styles.menuItemWrapper}>
            <span style={styles.menuItem} onClick={(e) => { e.stopPropagation(); setActiveMenu(activeMenu === 'file' ? null : 'file'); }}>File</span>
            {activeMenu === 'file' && (
              <div style={styles.dropdown}>
                <div style={styles.dropdownItem} onClick={() => { setShowSettings(true); setActiveMenu(null); }}>Settings...</div>
                <div style={styles.dropdownItem} className="has-submenu">
                  Export <ChevronRight size={12}/>
                  <div style={styles.subMenu}>
                    <div style={styles.dropdownItem} onClick={() => exportAudio('wav')}>To .WAV</div>
                    <div style={styles.dropdownItem} onClick={() => exportAudio('mp3')}>To .MP3</div>
                  </div>
                </div>
              </div>
            )}
          </div>
          <div style={styles.menuItemWrapper}>
            <span style={styles.menuItem} onClick={(e) => { e.stopPropagation(); setActiveMenu(activeMenu === 'help' ? null : 'help'); }}>Help</span>
            {activeMenu === 'help' && (
              <div style={styles.dropdown}>
                <div style={styles.dropdownItem} onClick={() => setShowVersion(true)}>Version Info</div>
              </div>
            )}
          </div>
        </div>

        <div style={styles.toolbar}>
          <div style={styles.btnGroup}>
            <button style={styles.retroBtn} onClick={() => { if (!isPlaying) Tone.Transport.start(); else Tone.Transport.pause(); setIsPlaying(!isPlaying); }}>
              {isPlaying ? <Pause fill="#000" size={20}/> : <Play fill="#00ff41" size={20}/>}
            </button>
            <button style={styles.retroBtn} onClick={handleStop}><Square fill="red" size={20}/></button>
          </div>
          <div style={styles.ledDisplay}>
            <div style={{fontSize:'10px', color: themeMode === 'darkest' ? '#00ff41' : 'red'}}>TEMPO</div>
            <div style={{fontSize:'32px', color: themeMode === 'darkest' ? '#00ff41' : 'red'}}>{bpm}</div>
          </div>
          <input type="range" min="40" max="250" value={bpm} onChange={(e) => setBpm(e.target.value)} style={styles.slider} />
        </div>

        <div ref={rackRef} style={{...styles.rackContainer, background: currentTheme.rack}}>
          <div style={styles.rack}>
            {TRACK_NAMES.map(name => (
              <div key={name} style={styles.trackRow}>
                <div style={{...styles.trackHead, background: currentTheme.rack}}><div style={{...styles.lcd, borderColor: currentTheme.border}}>{name}</div></div>
                <div style={styles.steps}>
                  {tracks[name].steps.map((on, i) => (
                    <div
                      key={i}
                      onClick={() => {
                        const nt = { ...tracks };
                        nt[name].steps[i] = !on;
                        setTracks(nt);
                      }}
                      style={{
                        ...styles.step,
                        background: on ? '#00ff41' : (Math.floor(i / 4) % 2 === 0 ? '#555' : '#333'),
                        boxShadow: i === activeStep ? '0 0 15px #00ff41' : 'none',
                        border: `1px solid ${themeMode === 'darkest' ? '#00ff41' : '#000'}`
                      }}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {showVersion && (
        <div style={styles.modalOverlay}>
          <div style={styles.modal}>
            <div style={styles.modalHeader}><span>ABOUT</span><X size={14} onClick={() => setShowVersion(false)}/></div>
            <div style={styles.modalBody}>
              <Activity size={40} />
              <h2>ZaBeats Studio</h2>
              <p>Build 1.8.4 - 1995 Desktop</p>
            </div>
          </div>
        </div>
      )}

      {showSettings && (
        <div style={styles.modalOverlay}>
          <div style={styles.modal}>
            <div style={styles.modalHeader}><span>SETTINGS</span><X size={14} onClick={() => setShowSettings(false)}/></div>
            <div style={{padding: '20px', color: '#000'}}>
              <label>THEME:</label>
              <div style={{display:'flex', gap: '5px', margin: '10px 0'}}>
                {['light', 'dark', 'darkest'].map(m => <button key={m} style={styles.retroBtn} onClick={()=>setThemeMode(m)}>{m.toUpperCase()}</button>)}
              </div>
              <label>END BEHAVIOR:</label>
              <select style={{width:'100%', padding:'5px', marginTop:'5px'}} value={endAction} onChange={e => setEndAction(e.target.value)}>
                <option value="stopAtLast">Stop at Last Beat</option>
                <option value="stop">Stop at Step 64</option>
                <option value="loop">Continuous Loop</option>
              </select>
              <button style={{width:'100%', marginTop:'20px', padding:'10px'}} onClick={()=>setShowSettings(false)}>APPLY</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const styles = {
  desktopContainer: { height: '100vh', width: '100vw', display: 'flex', flexDirection: 'column', overflow: 'hidden' },
  window: { height: '100vh', width: '100vw', display: 'flex', flexDirection: 'column', border: '3px solid' },
  titleBar: { color: 'white', padding: '6px 12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontWeight: 'bold', fontSize: '12px' },
  menuBar: { background: '#c0c0c0', display: 'flex', gap: '10px', padding: '5px 20px', borderBottom: '2px solid #000' },
  menuItemWrapper: { position: 'relative' },
  menuItem: { cursor: 'pointer', fontSize: '12px', padding: '2px 8px' },
  dropdown: { position: 'absolute', top: '100%', left: 0, background: '#c0c0c0', border: '1px solid #000', width: '160px', zIndex: 1000, boxShadow: '2px 2px 0 #000' },
  dropdownItem: { padding: '8px', fontSize: '11px', color: '#000', borderBottom: '1px solid #888', cursor: 'pointer', position: 'relative', display: 'flex', justifyContent: 'space-between' },
  subMenu: { display: 'none', position: 'absolute', left: '100%', top: 0, background: '#c0c0c0', border: '1px solid #000', width: '120px' },
  toolbar: { padding: '15px', display: 'flex', alignItems: 'center', gap: '40px', background: '#888', borderBottom: '4px double #000' },
  ledDisplay: { background: '#000', padding: '10px', border: '3px inset #fff', textAlign: 'center', minWidth: '100px' },
  retroBtn: { background: '#c0c0c0', border: '2px solid #fff', borderRightColor: '#000', borderBottomColor: '#000', cursor: 'pointer', padding: '5px 10px' },
  rackContainer: { flex: 1, overflow: 'hidden', padding: '20px' },
  rack: { display: 'flex', flexDirection: 'column', gap: '8px', minWidth: '2600px' },
  trackRow: { display: 'flex', alignItems: 'center', gap: '10px' },
  trackHead: { width: '100px', position: 'sticky', left: 0, zIndex: 10 },
  lcd: { background: '#000', color: '#00ff41', padding: '6px', border: '2px inset', fontSize: '10px', textAlign: 'center' },
  steps: { display: 'flex', gap: '2px' },
  step: { width: '32px', height: '48px', cursor: 'pointer' },
  slider: { width: '300px' },
  modalOverlay: { position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', background: 'rgba(0,0,0,0.8)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 9999 },
  modal: { background: '#c0c0c0', border: '2px solid #fff', borderRightColor: '#000', borderBottomColor: '#000', width: '350px', padding: '2px' },
  modalHeader: { background: '#000080', color: '#fff', padding: '4px 8px', display: 'flex', justifyContent: 'space-between', fontSize: '12px' },
  modalBody: { padding: '30px', textAlign: 'center', color: '#000' }
};

export default App;