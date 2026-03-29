import { useState, useEffect } from "react";

// ─── CONFIG ────────────────────────────────────────────────────────────────
const IS_NETLIFY = typeof window !== "undefined" &&
  !window.location.hostname.includes("claude") &&
  window.location.hostname !== "localhost";
const PROXY_URL  = "/.netlify/functions/gemini";
const DIRECT_URL = (key) =>
  `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${key}`;

const MAX_FREE_TRIALS = 3;
const STORAGE_KEYS = { apiKey: "vg_gemini_key", trials: "vg_trial_count" };

const C = {
  bg:"#08080E", surface:"#10101A", card:"#14141F", border:"#1F1F32",
  accent:"#7C6FFF", cyan:"#00DFFF", green:"#00E5A0",
  red:"#FF4C6A", orange:"#FF9432",
  text:"rgba(255,255,255,0.9)", muted:"rgba(255,255,255,0.38)",
};

const PARAMS = {
  style:    ["🎬 Cinématique","📽️ Documentaire","📱 Vlog","✨ Animé"],
  tone:     ["🔥 Motivant","📚 Éducatif","😄 Humoristique","🎭 Dramatique"],
  format:   ["📱 Portrait 9:16","🖥️ Paysage 16:9","⬛ Carré 1:1"],
  duration: ["⏱️ 30 sec","⏱️ 1 min","⏱️ 2 min"],
};
const DURATION_SECONDS = {"⏱️ 30 sec":30,"⏱️ 1 min":60,"⏱️ 2 min":120};

// ─── GEMINI CALL ─────────────────────────────────────────────────────────────
async function callGemini(apiKey, idea, style, tone, durationLabel) {
  const seconds    = DURATION_SECONDS[durationLabel] || 60;
  const sceneCount = Math.round(Math.max(3, Math.min(10, seconds / 8)));
  const secPerScene = Math.round(seconds / sceneCount);

  const prompt = `Tu es un expert en vidéos courtes virales pour TikTok, Instagram Reels et YouTube Shorts.
Tu es spécialisé dans le contenu francophone africain, particulièrement pour la Côte d'Ivoire (Abidjan).
Tu rédiges des scripts percutants, directs, authentiques et culturellement ancrés.

Génère un script de vidéo courte :
IDÉE : "${idea}"
STYLE : ${style} | TON : ${tone}
DURÉE : ${seconds}s — ${sceneCount} scènes (≈ ${secPerScene}s/scène)

RÈGLES :
1. Narration en français ivoirien naturel (nouchi OK si pertinent)
2. Première scène = accroche choc — arrête le scroll immédiatement
3. keyword OBLIGATOIREMENT en ANGLAIS pour Pixabay
4. Texte oral uniquement — pas de didascalies

RÉPONDS UNIQUEMENT avec ce tableau JSON (sans texte avant/après) :
[{"index":1,"narration":"texte ivoirien","keyword":"english keyword"},...]`;

  let res;
  if (IS_NETLIFY) {
    res = await fetch(PROXY_URL, {
      method:"POST", headers:{"Content-Type":"application/json"},
      body: JSON.stringify({ prompt, apiKey }),
    });
    if (!res.ok) {
      const err = await res.json().catch(()=>({}));
      throw new Error(err.error || `Proxy erreur ${res.status}`);
    }
  } else {
    res = await fetch(DIRECT_URL(apiKey), {
      method:"POST", headers:{"Content-Type":"application/json"},
      body: JSON.stringify({
        contents:[{parts:[{text:prompt}]}],
        generationConfig:{ temperature:0.85,topK:40,topP:0.95,maxOutputTokens:1500,responseMimeType:"application/json" },
      }),
    });
    if (res.status===429) throw new Error("Limite Gemini (15 req/min). Attends 1 minute.");
    if (!res.ok) {
      const err = await res.json().catch(()=>({}));
      throw new Error(`Gemini ${res.status}: ${err?.error?.message||res.statusText}`);
    }
  }

  const data = await res.json();
  const candidates = data.candidates;
  if (!candidates?.length) throw new Error(`Réponse bloquée. Reformule ton idée.`);
  const raw = candidates[0].content.parts[0].text;
  return JSON.parse(raw.replace(/```json|```/g,"").trim());
}

// ─── UTILS ───────────────────────────────────────────────────────────────────
const row = (justify="flex-start",gap=0) =>
  ({display:"flex",flexDirection:"row",alignItems:"center",justifyContent:justify,gap});
const cardS = (extra={}) =>
  ({background:C.card,border:`1px solid ${C.border}`,borderRadius:16,padding:"18px 20px",...extra});

// ══════════════════════════════════════════════════════════════════════════════
export default function App() {
  const [screen, setScreen] = useState("home");
  const [apiKey, setApiKey] = useState("");
  const [trials, setTrials] = useState(0);

  useEffect(()=>{
    setApiKey(localStorage.getItem(STORAGE_KEYS.apiKey)||"");
    setTrials(parseInt(localStorage.getItem(STORAGE_KEYS.trials)||"0",10));
  },[]);

  const saveApiKey = k => { localStorage.setItem(STORAGE_KEYS.apiKey,k.trim()); setApiKey(k.trim()); };
  const incrementTrial = () => {
    const n = trials+1;
    localStorage.setItem(STORAGE_KEYS.trials,String(n));
    setTrials(n);
  };
  const p = {apiKey,saveApiKey,trials,trialsLeft:MAX_FREE_TRIALS-trials,
    isBlocked:trials>=MAX_FREE_TRIALS,incrementTrial,setScreen};

  return (
    <div style={{minHeight:"100vh",background:C.bg,color:C.text,fontFamily:"'Courier New',monospace"}}>
      <style>{`
        *{box-sizing:border-box;margin:0;padding:0}
        @keyframes fadeUp{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:none}}
        textarea,input{font-family:'Courier New',monospace}
        ::-webkit-scrollbar{width:4px}::-webkit-scrollbar-thumb{background:${C.border};border-radius:4px}
      `}</style>
      {screen==="home"     && <HomeScreen     {...p}/>}
      {screen==="settings" && <SettingsScreen {...p}/>}
      {screen==="paywall"  && <PaywallScreen  {...p}/>}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// HOME
// ══════════════════════════════════════════════════════════════════════════════
function HomeScreen({apiKey,trialsLeft,isBlocked,incrementTrial,setScreen}) {
  const [idea,setIdea]         = useState("");
  const [params,setParams]     = useState({style:PARAMS.style[0],tone:PARAMS.tone[0],format:PARAMS.format[0],duration:PARAMS.duration[1]});
  const [loading,setLoading]   = useState(false);
  const [stepMsg,setStepMsg]   = useState("");
  const [progress,setProgress] = useState(0);
  const [scenes,setScenes]     = useState([]);
  const [error,setError]       = useState("");
  const [copied,setCopied]     = useState(false);
  const [sheet,setSheet]       = useState(null);
  const sp = k => v => setParams(p=>({...p,[k]:v}));

  async function generate() {
    if (isBlocked){setScreen("paywall");return;}
    if (!idea.trim()){setError("Entre une idée !");return;}
    if (!apiKey){setError("Configure ta clé Gemini dans ⚙️.");return;}
    setLoading(true);setError("");setScenes([]);setProgress(15);
    setStepMsg("🧠  Gemini rédige le script…");
    try {
      const r = await callGemini(apiKey,idea,params.style,params.tone,params.duration);
      setProgress(100);setStepMsg("✅  Script prêt !");setScenes(r);incrementTrial();
    } catch(e){
      setError(e.message||"Erreur inconnue");setStepMsg("");setProgress(0);
    } finally {setLoading(false);}
  }

  return (
    <div style={{maxWidth:520,margin:"0 auto",padding:"28px 16px 80px"}}>
      {/* header */}
      <div style={{...row("space-between"),marginBottom:28}}>
        <div>
          <div style={{fontSize:22,fontWeight:900,color:C.accent,letterSpacing:"0.18em"}}>AI VIDEO</div>
          <div style={{fontSize:10,color:C.cyan,letterSpacing:"0.4em",marginTop:2}}>SCRIPT GENERATOR</div>
        </div>
        <div style={{...row("flex-end",10)}}>
          <Badge trialsLeft={trialsLeft} isBlocked={isBlocked}/>
          <Btn onClick={()=>setScreen("settings")}>⚙️</Btn>
        </div>
      </div>

      {/* idea */}
      <Lbl>VOTRE IDÉE</Lbl>
      <textarea value={idea} onChange={e=>setIdea(e.target.value)} rows={4}
        placeholder="Ex: Une vidéo motivante sur l'épargne pour les jeunes Ivoiriens…"
        style={{width:"100%",background:C.surface,border:`1px solid ${C.border}`,borderRadius:14,
          padding:14,color:C.text,fontSize:14,lineHeight:1.7,resize:"vertical",outline:"none",marginBottom:20}}
        onFocus={e=>e.target.style.borderColor=C.accent}
        onBlur={e=>e.target.style.borderColor=C.border}
      />

      {/* params */}
      <Lbl>PARAMÈTRES</Lbl>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginTop:8,marginBottom:24}}>
        {Object.keys(PARAMS).map(k=>(
          <button key={k} onClick={()=>setSheet(k)} style={{
            background:C.surface,border:`1px solid ${C.accent}44`,borderRadius:12,
            padding:"11px 13px",color:C.text,fontSize:12,cursor:"pointer",textAlign:"left",
            display:"flex",alignItems:"center",gap:8,fontFamily:"'Courier New',monospace"}}>
            <span style={{flex:1,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{params[k]}</span>
            <span style={{color:C.muted}}>›</span>
          </button>
        ))}
      </div>

      {/* generate btn */}
      <button onClick={generate} disabled={loading} style={{
        width:"100%",height:56,borderRadius:14,border:"none",
        background:loading?`${C.accent}44`:`linear-gradient(135deg,${C.accent},${C.cyan})`,
        color:"#fff",fontSize:14,fontWeight:900,letterSpacing:"0.12em",
        cursor:loading?"not-allowed":"pointer",
        boxShadow:loading?"none":`0 8px 28px ${C.accent}44`,
        marginBottom:20,fontFamily:"'Courier New',monospace"}}>
        {loading?"⏳  GÉNÉRATION…":isBlocked?"🔒  PASSER PREMIUM":"⚡  GÉNÉRER LE SCRIPT"}
      </button>

      {/* progress */}
      {(loading||(progress===100&&stepMsg))&&(
        <div style={{...cardS({marginBottom:16})}}>
          <div style={{color:C.cyan,fontSize:13,fontWeight:700,marginBottom:10}}>{stepMsg}</div>
          <div style={{background:`${C.accent}22`,borderRadius:6,height:6,overflow:"hidden"}}>
            <div style={{height:"100%",width:`${progress}%`,borderRadius:6,transition:"width 0.5s",
              background:`linear-gradient(90deg,${C.accent},${C.cyan})`}}/>
          </div>
          <div style={{fontSize:11,color:C.muted,marginTop:6}}>{progress}%</div>
        </div>
      )}

      {/* error */}
      {error&&<div style={{background:`${C.red}12`,border:`1px solid ${C.red}44`,borderRadius:12,
        padding:"13px 15px",color:C.red,fontSize:13,marginBottom:16}}>⚠️ {error}</div>}

      {/* scenes */}
      {scenes.length>0&&(
        <div style={{animation:"fadeUp 0.4s ease"}}>
          <div style={{...row("flex-start",10),flexWrap:"wrap",
            background:`${C.green}0A`,border:`1px solid ${C.green}33`,
            borderRadius:12,padding:"12px 16px",marginBottom:14}}>
            {[`✅ ${scenes.length} scènes`,params.duration,params.style].map(t=>
              <span key={t} style={{fontSize:12,color:C.green}}>{t}</span>)}
          </div>
          {scenes.map((s,i)=>(
            <div key={s.index} style={{...cardS({marginBottom:12}),
              borderLeft:`3px solid ${i%2===0?C.accent:C.cyan}`,
              animation:`fadeUp ${0.2+i*0.07}s ease`}}>
              <div style={{...row("space-between"),marginBottom:10}}>
                <span style={{fontSize:10,fontWeight:900,letterSpacing:"0.2em",color:i%2===0?C.accent:C.cyan}}>
                  SCÈNE {s.index}
                </span>
                <span style={{fontSize:10,background:`${C.green}18`,border:`1px solid ${C.green}44`,
                  borderRadius:20,padding:"3px 10px",color:C.green,fontWeight:700}}>
                  🔍 {s.keyword}
                </span>
              </div>
              <div style={{fontSize:14,lineHeight:1.75}}>{s.narration}</div>
            </div>
          ))}
          <button onClick={()=>{
            navigator.clipboard.writeText(scenes.map(s=>`Scène ${s.index} [${s.keyword}]\n${s.narration}`).join("\n\n"));
            setCopied(true);setTimeout(()=>setCopied(false),2000);
          }} style={{
            background:copied?`${C.green}22`:`${C.accent}18`,
            border:`1px solid ${copied?C.green:C.accent}`,borderRadius:12,
            padding:"12px 20px",color:copied?C.green:C.accent,fontSize:13,fontWeight:700,
            cursor:"pointer",fontFamily:"'Courier New',monospace",width:"100%",marginTop:4}}>
            {copied?"✅ Copié !":"📋  Copier le script complet"}
          </button>
        </div>
      )}

      {sheet&&<Sheet title={sheet.toUpperCase()} options={PARAMS[sheet]} current={params[sheet]}
        onSelect={v=>{sp(sheet)(v);setSheet(null);}} onClose={()=>setSheet(null)}/>}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// SETTINGS
// ══════════════════════════════════════════════════════════════════════════════
function SettingsScreen({apiKey,saveApiKey,setScreen}) {
  const [input,setInput]     = useState(apiKey);
  const [hide,setHide]       = useState(true);
  const [saved,setSaved]     = useState(false);
  const [testing,setTesting] = useState(false);
  const [result,setResult]   = useState("");

  const handleSave = () => {
    if(!input.trim())return;
    saveApiKey(input);setSaved(true);setTimeout(()=>setSaved(false),2000);
  };
  const handleTest = async () => {
    if(!input.trim()){setResult("❌ Entre ta clé d'abord.");return;}
    setTesting(true);setResult("");
    try {
      const s = await callGemini(input.trim(),"test","Vlog","Éducatif","⏱️ 30 sec");
      setResult(`✅ Connexion réussie ! ${s.length} scènes générées.`);
    } catch(e){setResult(`❌ ${e.message}`);}
    finally{setTesting(false);}
  };

  return (
    <div style={{maxWidth:520,margin:"0 auto",padding:"28px 16px 80px"}}>
      <div style={{...row("space-between"),marginBottom:28}}>
        <Btn onClick={()=>setScreen("home")}>← Retour</Btn>
        <div style={{fontSize:12,color:C.muted,letterSpacing:"0.2em"}}>PARAMÈTRES</div>
        <div style={{width:72}}/>
      </div>

      <div style={cardS({marginBottom:16})}>
        <div style={{fontSize:14,fontWeight:700,marginBottom:4}}>🔑 Clé Gemini API</div>
        <div style={{fontSize:12,color:C.muted,marginBottom:12,lineHeight:1.6}}>
          Gratuite sur <span style={{color:C.cyan}}>aistudio.google.com</span> → Get API Key → Create API key
        </div>

        {/* Explication CORS */}
        <div style={{fontSize:12,background:`${C.accent}0A`,border:`1px solid ${C.accent}33`,
          borderRadius:10,padding:"10px 13px",marginBottom:14,color:C.muted,lineHeight:1.7}}>
          <span style={{color:C.accent,fontWeight:700}}>⚡ Ici dans claude.ai :</span> le test fonctionne directement.<br/>
          <span style={{color:C.green,fontWeight:700}}>📱 Sur Netlify (ton app) :</span> la clé passe par un proxy sécurisé.<br/>
          Ta clé est stockée <span style={{color:C.green}}>uniquement sur ton téléphone</span>.
        </div>

        <div style={{position:"relative",marginBottom:12}}>
          <input type={hide?"password":"text"} value={input} onChange={e=>setInput(e.target.value)}
            placeholder="AIzaSy..." style={{width:"100%",background:C.surface,
              border:`1px solid ${C.border}`,borderRadius:12,padding:"13px 44px 13px 14px",
              color:C.text,fontSize:13,outline:"none"}}
            onFocus={e=>e.target.style.borderColor=C.accent}
            onBlur={e=>e.target.style.borderColor=C.border}
          />
          <button onClick={()=>setHide(!hide)} style={{position:"absolute",right:12,
            top:"50%",transform:"translateY(-50%)",background:"none",border:"none",
            color:C.muted,cursor:"pointer",fontSize:16}}>{hide?"👁️":"🙈"}</button>
        </div>

        <div style={{...row("flex-start",10),marginBottom:result?12:0}}>
          <Btn onClick={handleSave} color={saved?C.green:C.accent} style={{flex:1,height:44}}>
            {saved?"✅ Sauvegardé !":"💾 Sauvegarder"}
          </Btn>
          <Btn onClick={handleTest} disabled={testing} color={C.cyan} style={{flex:1,height:44}}>
            {testing?"⏳ Test…":"🧪 Tester"}
          </Btn>
        </div>

        {result&&<div style={{padding:"11px 14px",borderRadius:10,fontSize:12,
          background:result.startsWith("✅")?`${C.green}12`:`${C.red}12`,
          border:`1px solid ${result.startsWith("✅")?C.green:C.red}44`,
          color:result.startsWith("✅")?C.green:C.red}}>{result}</div>}
      </div>

      <div style={cardS()}>
        <div style={{fontSize:14,fontWeight:700,marginBottom:14}}>📊 Limites gratuites</div>
        {[["gemini-2.0-flash","15/min","1 500/jour",C.green,true],
          ["gemini-1.5-flash","15/min","1 500/jour",C.cyan,false],
          ["gemini-1.5-pro",  "2/min",  "50/jour",  C.orange,false]].map(([m,pm,pd,cl,act])=>(
          <div key={m} style={{...row("space-between"),marginBottom:10}}>
            <div style={{...row("flex-start",8)}}>
              <div style={{width:8,height:8,borderRadius:"50%",background:cl}}/>
              <span style={{fontSize:12,color:act?C.text:C.muted}}>{m}</span>
              {act&&<span style={{fontSize:10,color:C.green,background:`${C.green}18`,
                border:`1px solid ${C.green}44`,borderRadius:10,padding:"1px 7px"}}>actif</span>}
            </div>
            <div style={{...row("flex-end",12)}}>
              <span style={{fontSize:11,color:C.muted}}>{pm}</span>
              <span style={{fontSize:11,color:cl,fontWeight:700}}>{pd}</span>
            </div>
          </div>
        ))}
        <div style={{marginTop:12,padding:"10px 12px",background:`${C.accent}0A`,
          borderRadius:10,fontSize:12,color:C.muted,lineHeight:1.6}}>
          💡 1 500 req/jour = ~<span style={{color:C.accent}}>500 scripts/jour</span>. Largement suffisant.
        </div>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// PAYWALL
// ══════════════════════════════════════════════════════════════════════════════
function PaywallScreen({setScreen}) {
  return (
    <div style={{maxWidth:520,margin:"0 auto",padding:"60px 20px"}}>
      <div style={{textAlign:"center",marginBottom:36}}>
        <div style={{width:80,height:80,borderRadius:"50%",margin:"0 auto 20px",
          background:`linear-gradient(135deg,${C.accent},${C.cyan})`,
          display:"flex",alignItems:"center",justifyContent:"center",fontSize:32}}>🚀</div>
        <div style={{fontSize:26,fontWeight:900,letterSpacing:"0.1em",lineHeight:1.2,marginBottom:12}}>
          DÉBLOQUEZ<br/>L'ILLIMITÉ
        </div>
        <div style={{fontSize:14,color:C.muted,lineHeight:1.7}}>
          Vos 3 essais gratuits sont épuisés.<br/>Passez Premium pour générer sans limite.
        </div>
      </div>
      <div style={cardS({marginBottom:20})}>
        {["⚡ Scripts illimités","🎬 Tous styles & tons","🔊 Voix MP3 incluse","📱 PWA installable"].map(f=>(
          <div key={f} style={{...row("flex-start",12),marginBottom:12}}>
            <div style={{width:7,height:7,borderRadius:"50%",background:C.green,flexShrink:0}}/>
            <span style={{fontSize:14}}>{f}</span>
          </div>
        ))}
      </div>
      <div style={{...cardS({marginBottom:20,textAlign:"center"}),background:`${C.accent}0A`,border:`1px solid ${C.accent}44`}}>
        <span style={{fontSize:42,fontWeight:900,color:C.accent}}>1,5$</span>
        <span style={{fontSize:16,color:C.muted,marginLeft:8}}>/ mois</span>
      </div>
      <button style={{width:"100%",height:56,borderRadius:14,border:"none",
        background:`linear-gradient(135deg,${C.accent},${C.cyan})`,
        color:"#fff",fontSize:14,fontWeight:900,cursor:"pointer",
        fontFamily:"'Courier New',monospace",boxShadow:`0 8px 28px ${C.accent}44`,marginBottom:14}}>
        💳  PASSER PREMIUM — 1,5$ / MOIS
      </button>
      <button onClick={()=>setScreen("home")} style={{width:"100%",background:"none",
        border:"none",color:C.muted,fontSize:13,cursor:"pointer",fontFamily:"'Courier New',monospace"}}>
        ← Retour
      </button>
    </div>
  );
}

// ─── MINI COMPONENTS ─────────────────────────────────────────────────────────
function Lbl({children}){
  return <div style={{fontSize:10,letterSpacing:"0.28em",color:C.muted,fontWeight:700,marginBottom:8}}>{children}</div>;
}
function Badge({trialsLeft,isBlocked}){
  const c=isBlocked?C.red:trialsLeft<=1?C.orange:C.accent;
  return <div style={{padding:"6px 13px",borderRadius:20,border:`1px solid ${c}`,
    background:`${c}18`,fontSize:11,color:c,fontWeight:700}}>
    {isBlocked?"🔒 Limité":`${trialsLeft} essai${trialsLeft>1?"s":""}`}
  </div>;
}
function Btn({children,onClick,color=C.accent,disabled,style={}}){
  return <button onClick={onClick} disabled={disabled} style={{
    background:`${color}18`,border:`1px solid ${color}55`,borderRadius:12,
    padding:"8px 16px",color,fontWeight:700,fontSize:13,
    cursor:disabled?"not-allowed":"pointer",
    fontFamily:"'Courier New',monospace",...style}}>{children}</button>;
}
function Sheet({title,options,current,onSelect,onClose}){
  return <>
    <div onClick={onClose} style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.65)",zIndex:10}}/>
    <div style={{position:"fixed",bottom:0,left:"50%",transform:"translateX(-50%)",
      width:"100%",maxWidth:520,background:C.surface,borderRadius:"20px 20px 0 0",
      border:`1px solid ${C.border}`,padding:"20px 20px 40px",zIndex:11,animation:"fadeUp 0.2s ease"}}>
      <div style={{fontSize:10,letterSpacing:"0.3em",color:C.muted,fontWeight:700,marginBottom:16}}>{title}</div>
      {options.map(o=>(
        <button key={o} onClick={()=>onSelect(o)} style={{width:"100%",textAlign:"left",
          padding:"14px 16px",marginBottom:8,
          background:o===current?`${C.accent}18`:C.card,
          border:`1px solid ${o===current?C.accent:C.border}`,
          borderRadius:12,color:o===current?C.accent:C.text,
          fontSize:14,fontWeight:o===current?700:400,
          cursor:"pointer",fontFamily:"'Courier New',monospace"}}>{o}</button>
      ))}
    </div>
  </>;
}
