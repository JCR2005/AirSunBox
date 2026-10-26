import { useState, useEffect, useRef } from "react";
import { Link } from "react-router-dom";

// 1. IMPORTAMOS TU IMAGEN DESDE LA CARPETA ASSETS
import logoImg from "../assets/logo2.svg";

// 3. NUEVO: IMPORTAMOS EL QR DE TU BOT
import qrBotImg from "../assets/qrTelegram.png";

const COLORS = {
  primary: "#67B7E8",
  accent: "#2BA8A0",
  bgDark: "#0A0F18",
  bgLight: "#F0F7FC",
  text: "#0A0F18",
  textMuted: "#5A7080",
  border: "#D6E8F5",
  white: "#ffffff",
  // Nuevos colores para la simulación de chat
  tgUserBubble: "#7B61FF", // Morado de usuario
  tgChecks: "#67B7E8",    // Checks azules
};

// 2. REEMPLAZAMOS EL SVG DE ABAJO POR UN COMPONENTE QUE USA TU IMAGEN REAL
const AirSunBoxLogo = ({ size = 48 }) => (
  <img 
    src={logoImg} 
    alt="AirSunBox Logo" 
    style={{
      width: size,
      height: "auto", // Mantiene la proporción original automáticamente
      display: "block"
    }}
  />
);

const useScrollReveal = () => {
  const ref = useRef(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { threshold: 0.15 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  return { ref, visible };
};

const Reveal = ({ children, delay = 0, style = {} }) => {
  const { ref, visible } = useScrollReveal();
  return (
    <div
      ref={ref}
      style={{
        opacity: visible ? 1 : 0,
        transform: visible ? "translateY(0)" : "translateY(24px)",
        transition: `opacity 0.6s ease ${delay}ms, transform 0.6s ease ${delay}ms`,
        ...style,
      }}
    >
      {children}
    </div>
  );
};

const FEATURES = [
  {
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#67B7E8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/>
      </svg>
    ),
    title: "Datos en tiempo real",
    desc: "Los valores llegan en segundos vía MQTT. Sin retrasos, sin intermediarios.",
  },
  {
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#67B7E8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="22 7 13.5 15.5 8.5 10.5 2 17"/>
        <polyline points="16 7 22 7 22 13"/>
      </svg>
    ),
    title: "Historial gráfico",
    desc: "Consultá desde 1 hora hasta 2 años atrás. Identificá patrones y tendencias.",
  },
  {
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#67B7E8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
        <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
      </svg>
    ),
    title: "Alertas automáticas",
    desc: "Configura umbrales por sensor. Recibí notificaciones por correo o webhook.",
  },
  {
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#67B7E8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <polygon points="3 6 9 3 15 6 21 3 21 18 15 21 9 18 3 21"/>
        <line x1="9" y1="3" x2="9" y2="18"/>
        <line x1="15" y1="6" x2="15" y2="21"/>
      </svg>
    ),
    title: "Mapa de estaciones",
    desc: "Ubicación exacta de cada estación con su estado en vivo.",
  },
  {
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#67B7E8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="2" y="3" width="20" height="14" rx="2" ry="2"/>
        <line x1="8" y1="21" x2="16" y2="21"/>
        <line x1="12" y1="17" x2="12" y2="21"/>
      </svg>
    ),
    title: "Multi-dispositivo",
    desc: "Todas tus estaciones en un solo panel. Acceso desde cualquier dispositivo.",
  },
  {
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#67B7E8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
        <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
      </svg>
    ),
    title: "Seguro y confiable",
    desc: "Autenticación JWT, datos cifrados y 2 años de historial respaldado.",
  },
];

const PLANS = [
  {
    name: "Suscripción Patrocinador RSE",
    price: "Q6,000",
    period: "/año",
    desc: "Para empresas que quieren visibilidad e impacto ambiental real",
    features: [
      "Logotipo en plataforma web y mapa interactivo",
      "Mención en alertas del Canal de WhatsApp",
      "Sello Verde físico con código QR para tu empresa",
      "Acceso a plataforma privada de datos ambientales",
      "20% destinado al Fondo de Acción Climática AirSunBox",
      "Reforestación urbana y mitigación de islas de calor en Xela",
    ],
    cta: "Unirse al consorcio",
    popular: true,
  }
];

const STEPS = [
  {
    n: "01",
    title: "Sume su marca",
    desc: "Se une al co-patrocinio.\nSu empresa se une al consorcio de marcas líderes que hacen posible la red de monitoreo en Quetzaltenango.\nNosotros nos encargamos de la fabricación, instalación y soporte técnico; su organización solo se suma al impacto."
  },
  {
    n: "02",
    title: "Desplegamos su RSE",
    desc: "Activamos su presencia.\nIntegramos el logotipo e identidad de su organización en nuestra plataforma web, en el mapa interactivo y en las alertas del Canal de WhatsApp.\nAdemás, le entregamos el Sello Verde físico con código QR para sus mostradores y agencias."
  },
  {
    n: "03",
    title: "Financie la solución",
    desc: "Impulsa el Fondo Ambiental.\nEl 20% de su suscripción anual se destina directamente al Fondo de Acción Climática AirSunBox.\nSu marca financia activamente las jornadas de reforestación urbana y los sistemas de mitigación de calor en las calles de Xela."
  }
];

const SENSORS = [
  "MQ-135",
  "MQ-7",
  "DHT11",
  "MQ-131",
  "MQ-135",
  "MQ-136",
  "PMS5003"
];

export default function Landing() {
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <div
      style={{
        fontFamily:
          '"DM Sans", -apple-system, BlinkMacSystemFont, sans-serif',
        background: COLORS.bgLight,
        color: COLORS.text,
        minHeight: "100vh",
        overflowX: "hidden",
      }}
    >
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600&family=Syne:wght@700;800&display=swap');
        *{box-sizing:border-box;margin:0;padding:0;}
        html{scroll-behavior:smooth;}
        a{color:inherit;text-decoration:none;}
        .nav-link{
          color:${COLORS.textMuted};
          font-size:.9rem;
          font-weight:500;
          padding:6px 0;
          position:relative;
          transition:color .2s;
        }
        .nav-link::after{
          content:'';
          position:absolute;
          bottom:-2px;left:0;
          width:0;height:1.5px;
          background:${COLORS.primary};
          transition:width .2s;
        }
        .nav-link:hover{color:${COLORS.primary};}
        .nav-link:hover::after{width:100%;}
        .btn-primary{
          background:${COLORS.primary};
          color:#fff;
          padding:12px 28px;
          border-radius:10px;
          font-weight:600;
          font-size:.9rem;
          border:none;cursor:pointer;
          transition:background .2s, transform .15s, box-shadow .2s;
          display:inline-flex;align-items:center;gap:8px;
          box-shadow:0 2px 12px rgba(103,183,232,.25);
        }
        .btn-primary:hover{background:#52A8E0;transform:translateY(-1px);box-shadow:0 4px 18px rgba(103,183,232,.35);}
        .btn-primary:active{transform:translateY(0);}
        .btn-outline{
          background:transparent;
          color:${COLORS.text};
          padding:12px 28px;
          border-radius:10px;
          font-weight:500;
          font-size:.9rem;
          border:1.5px solid ${COLORS.border};
          cursor:pointer;
          transition:border-color .2s, color .2s, background .2s;
          display:inline-flex;align-items:center;gap:8px;
        }
        .btn-outline:hover{border-color:${COLORS.primary};color:${COLORS.primary};background:rgba(103,183,232,.04);}
        .feature-card{
          background:#fff;
          border:1px solid ${COLORS.border};
          border-radius:16px;
          padding:28px 24px;
          transition:box-shadow .2s, transform .2s, border-color .2s;
        }
        .feature-card:hover{
          box-shadow:0 8px 32px rgba(103,183,232,.12);
          transform:translateY(-3px);
          border-color:${COLORS.primary};
        }
        .plan-card{
          background:#fff;
          border:1.5px solid ${COLORS.border};
          border-radius:20px;
          padding:32px 28px;
          position:relative;
          transition:box-shadow .2s, transform .2s;
        }
        .plan-card:hover{
          box-shadow:0 10px 40px rgba(103,183,232,.15);
          transform:translateY(-4px);
        }
        .plan-popular{
          border-color:${COLORS.primary};
          box-shadow:0 4px 24px rgba(103,183,232,.18);
        }
        .sensor-pill{
          background:rgba(103,183,232,.10);
          color:${COLORS.primary};
          border:1px solid rgba(103,183,232,.25);
          border-radius:99px;
          padding:6px 16px;
          font-size:.8rem;
          font-weight:600;
          white-space:nowrap;
          transition:background .2s;
        }
        .sensor-pill:hover{background:rgba(103,183,232,.2);}
        .step-number{
          font-family:'Syne',sans-serif;
          font-size:3.5rem;
          font-weight:800;
          color:rgba(103,183,232,.18);
          line-height:1;
          margin-bottom:12px;
        }
        .divider{
          border:none;
          border-top:1px solid ${COLORS.border};
          margin:0;
        }
        @keyframes float{
          0%,100%{transform:translateY(0);}
          50%{transform:translateY(-10px);}
        }
        @keyframes pulse-ring{
          0%{transform:scale(1);opacity:.5;}
          100%{transform:scale(1.5);opacity:0;}
        }
        @keyframes slide-in{
          from{opacity:0;transform:translateY(30px);}
          to{opacity:1;transform:translateY(0);}
        }
        .hero-badge{
          display:inline-flex;align-items:center;gap:8px;
          background:rgba(43,168,160,.08);
          border:1px solid rgba(43,168,160,.2);
          color:${COLORS.accent};
          padding:7px 18px;border-radius:99px;
          font-size:.8rem;font-weight:600;
          animation:slide-in .5s ease both;
        }
        .live-dot{
          width:7px;height:7px;
          background:${COLORS.accent};
          border-radius:50%;
          position:relative;display:inline-block;
        }
        .live-dot::after{
          content:'';
          position:absolute;top:-1px;left:-1px;
          width:9px;height:9px;
          border-radius:50%;
          background:${COLORS.accent};
          animation:pulse-ring 1.6s ease-out infinite;
        }
        .logo-float{animation:float 5s ease-in-out infinite;}
        .section-label{
          font-size:.72rem;
          font-weight:700;
          letter-spacing:.12em;
          text-transform:uppercase;
          color:${COLORS.primary};
          margin-bottom:10px;
        }
        .section-title{
          font-family:'Syne',sans-serif;
          font-size:clamp(1.8rem,3vw,2.6rem);
          font-weight:800;
          line-height:1.12;
          color:${COLORS.text};
          margin-bottom:16px;
        }
        .section-sub{
          color:${COLORS.textMuted};
          font-size:1rem;
          line-height:1.7;
          max-width:520px;
        }
        input,textarea{outline:none;}

        .menu-toggle {
          display: none;
          background: none;
          border: none;
          font-size: 1.6rem;
          cursor: pointer;
          color: ${COLORS.text};
          z-index: 210;
          padding: 4px;
        }

        /* ESTILOS DE CHAT DE TELEGRAM */
        .chat-bubble {
          border-radius: 12px;
          padding: 10px 14px;
          max-width: 85%;
          position: relative;
          opacity: 0;
          transform: translateY(10px);
          font-size: 0.8rem;
          color: rgba(255,255,255,0.9);
        }
        .chat-bubble::after {
          content: ""; position: absolute; top: 12px; width: 0; height: 0;
        }
        .chat-bot {
          background: rgba(255,255,255,0.06);
          border: 1px solid rgba(255,255,255,0.1);
          align-self: flex-start;
          border-bottom-left-radius: 4px;
        }
        .chat-bot::after {
          left: -8px; border-top: 8px solid rgba(255,255,255,0.06); border-left: 8px solid transparent;
        }
        .chat-user {
          background: ${COLORS.tgUserBubble};
          align-self: flex-end;
          border-bottom-right-radius: 4px;
        }
        .chat-user::after {
          right: -8px; border-top: 8px solid ${COLORS.tgUserBubble}; border-right: 8px solid transparent;
        }
        .checks-user {
          display: inline-block; width: 12px; height: 10px; margin-left: 4px; color: ${COLORS.tgChecks};
        }
        .check-bot {
          display: inline-block; width: 6px; height: 10px; margin-right: 4px; color: rgba(255,255,255,0.4);
        }
        @keyframes chat-in {
          to { opacity: 1; transform: translateY(0); }
        }

        /* ESTILOS DE BOTONES DE CHAT */
        .zone-btn-grid {
          display: grid; grid-template-columns: repeat(3, 1fr); gap: 6px; margin-top: 10px;
        }
        .zone-btn {
          background: rgba(255,255,255,0.85); color: rgba(0,0,0,0.8); padding: 7px; text-align: center; border-radius: 8px; font-size: 0.65rem; font-weight: 600; cursor: pointer; transition: background 0.2s;
        }
        .zone-btn:hover { background: rgba(255,255,255,1); }

        @media(max-width:680px){
          .nav-desktop {
            display: ${menuOpen ? 'flex' : 'none'} !important;
            flex-direction: column;
            position: absolute;
            top: 64px; left: 0; width: 100%;
            background: rgba(240,247,252,.98);
            backdrop-filter: blur(20px);
            padding: 32px 6vw;
            border-bottom: 1px solid ${COLORS.border};
            gap: 20px !important;
            box-shadow: 0 10px 30px rgba(103,183,232,.08);
          }
          .menu-toggle { display: block !important; }
          .hero-btns{flex-direction:column!important;}
          .hero-btns a, .hero-btns button{width:100%!important;justify-content:center!important;}
          .stats-grid{grid-template-columns:1fr 1fr!important;}
          .steps-grid{grid-template-columns:1fr!important;}
          .features-grid{grid-template-columns:1fr!important;}
          .plans-grid{grid-template-columns:1fr!important;}
          .footer-inner{flex-direction:column!important;text-align:center!important;gap:16px!important;}
        }
      `}</style>

      {/* NAV */}
      <nav
        style={{
          position: "sticky",
          top: 0,
          zIndex: 200,
          padding: "0 6vw",
          height: 100,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          background: scrolled ? "rgba(240,247,252,.95)" : COLORS.bgLight,
          backdropFilter: scrolled ? "blur(20px)" : "none",
          borderBottom: scrolled
            ? `1px solid ${COLORS.border}`
            : "1px solid transparent",
          transition: "all .3s ease",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <AirSunBoxLogo size={150} />
        </div>

        <button className="menu-toggle" onClick={() => setMenuOpen(!menuOpen)}>
          {menuOpen ? "✕" : "☰"}
        </button>

        <div
          className="nav-desktop"
          style={{
            display: "flex",
            alignItems: "center",
            gap: 32,
          }}
        >
          {/* NUEVO: ENLACE DIRECTO AL MAPA EN NETLIFY */}
          <a 
            href="https://voluble-creponne-e6c74f.netlify.app/mapa" 
            target="_blank" 
            rel="noopener noreferrer" 
            className="nav-link" 
            style={{ fontWeight: "700", color: COLORS.accent }}
            onClick={() => setMenuOpen(false)}
          >
            🗺️ Mapa en Vivo
          </a>
          <a href="#como-funciona" className="nav-link" onClick={() => setMenuOpen(false)}>
            Cómo funciona
          </a>
          <a href="#sensores" className="nav-link" onClick={() => setMenuOpen(false)}>
            Sensores
          </a>
          <Link to="/reportes-globales" className="nav-link" onClick={() => setMenuOpen(false)}>
            Reportes
          </Link>
          <a href="#precios" className="nav-link" onClick={() => setMenuOpen(false)}>
            Precios
          </a>
          <Link
            to="/login"
            className="btn-primary"
            style={{ padding: "9px 22px", fontSize: ".85rem" }}
            onClick={() => setMenuOpen(false)}
          >
            Ingresar
          </Link>
        </div>
      </nav>

      {/* HERO */}
      <section
        style={{
          minHeight: "calc(100vh - 64px)",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          textAlign: "center",
          padding: "80px 6vw 60px",
          position: "relative",
          background: `radial-gradient(ellipse 80% 60% at 50% 0%, rgba(103,183,232,.1) 0%, transparent 60%)`,
        }}
      >
        <div
          className="hero-badge"
          style={{ marginBottom: 28, animationDelay: "0ms" }}
        >
          <span className="live-dot" />
          Monitoreo ambiental en tiempo real
        </div>

        <div
          style={{
            animation: "slide-in .6s ease .1s both",
            marginBottom: 32,
          }}
        >
          <div className="logo-float" style={{ marginBottom: 24, display: "flex", justifyContent: "center" }}>
            <AirSunBoxLogo size={320} />
          </div>
          <h1
            style={{
              fontFamily: "'Syne', sans-serif",
              fontSize: "clamp(2.4rem,5vw,3.8rem)",
              fontWeight: 800,
              lineHeight: 1.08,
              letterSpacing: "-.02em",
              color: COLORS.text,
            }}
          >
            Calidad del aire,{" "}
            <span
              style={{
                color: COLORS.primary,
                position: "relative",
              }}
            >
              clara y visible
            </span>
            <br />
            para Guatemala
          </h1>
        </div>

        <p
          style={{
            animation: "slide-in .6s ease .2s both",
            fontSize: "1.05rem",
            color: COLORS.textMuted,
            lineHeight: 1.75,
            maxWidth: 520,
            marginBottom: 40,
          }}
        >
          AirSunBox conecta estaciones meteorológicas IoT con una plataforma
          que visualiza, alerta y registra la calidad del aire. Diseñado para
          municipalidades, empresas e industria.
        </p>

        <div
          className="hero-btns"
          style={{
            animation: "slide-in .6s ease .3s both",
            display: "flex",
            gap: 14,
            flexWrap: "wrap",
            justifyContent: "center",
          }}
        >
          <a href="#precios" className="btn-primary">
            Ver planes →
          </a>
          <a 
            href="https://voluble-creponne-e6c74f.netlify.app/mapa" 
            target="_blank" 
            rel="noopener noreferrer" 
            className="btn-outline"
          >
            Explorar Mapa Abierto
          </a>
        </div>
        
        <div
          style={{
            marginTop: 64,
            opacity: 0.35,
            fontSize: ".75rem",
            color: COLORS.textMuted,
            letterSpacing: ".08em",
            textTransform: "uppercase",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 8,
          }}
        >
          <div
            style={{
              width: 1,
              height: 36,
              background: COLORS.primary,
              animation: "float 1.8s ease-in-out infinite",
            }}
          />
          Scroll
        </div>
      </section>

      <hr className="divider" />

      {/* ── SECCIÓN DE BOT DE TELEGRAM (CORREGIDA) ───────────────────────────────────── */}
      <section style={{ padding: "88px 6vw", background: COLORS.bgLight }}>
        <Reveal>
          <div style={{
            position: "relative", overflow: "hidden",
            borderRadius: "24px",
            background: `linear-gradient(135deg, ${COLORS.bgDark} 0%, #0D1829 60%, #0A2A2A 100%)`,
            border: "1px solid rgba(103,183,232,.15)",
            padding: "56px 48px",
            display: "flex", alignItems: "center", justifyContent: "space-between",
            gap: "40px", flexWrap: "wrap",
            boxShadow: "0 20px 60px rgba(0,0,0,.2)",
          }}>
            {/* Auras decorativas de fondo */}
            <div style={{ position: "absolute", top: "-60px", right: "10%", width: "280px", height: "280px", borderRadius: "50%", background: "radial-gradient(circle, rgba(103,183,232,.12) 0%, transparent 70%)", pointerEvents: "none" }} />
            <div style={{ position: "absolute", bottom: "-80px", right: "30%", width: "200px", height: "200px", borderRadius: "50%", background: "radial-gradient(circle, rgba(43,168,160,.1) 0%, transparent 70%)", pointerEvents: "none" }} />

            {/* Texto izquierdo */}
            <div style={{ flex: 1, minWidth: "240px", position: "relative", zIndex: 1 }}>
              <div style={{ display: "inline-flex", alignItems: "center", gap: "8px", background: "rgba(43,168,160,.15)", border: "1px solid rgba(43,168,160,.3)", borderRadius: "99px", padding: "5px 14px", marginBottom: "20px" }}>
                <span className="live-dot" style={{ width: "7px", height: "7px", animation: "pulse-ring 1.6s ease-out infinite" }}/>
                <span style={{ fontSize: ".75rem", fontWeight: "700", color: "#2BA8A0", letterSpacing: ".06em", textTransform: "uppercase" }}>Asistente en Telegram</span>
              </div>
              <h2 style={{ fontFamily: "'Syne', sans-serif", fontSize: "clamp(1.6rem,3vw,2.4rem)", fontWeight: "800", color: "#ffffff", lineHeight: 1.1, letterSpacing: "-.02em", marginBottom: "14px" }}>
                Habla con nuestro Bot<br />
                <span style={{ color: COLORS.primary }}>en Telegram</span>
              </h2>
              <p style={{ fontSize: ".95rem", color: "rgba(255,255,255,.55)", lineHeight: 1.65, maxWidth: "380px", marginBottom: "28px" }}>
                Saluda, dinos tu zona (¡o solo pregúntanos!) y obtén los datos al instante, ¡o explora el mapa!
              </p>
              
              {/* ENLACE REAL AL BOT DE TELEGRAM */}
              <a 
                href="https://t.me/AIRSUBBOX_BOT" 
                target="_blank" 
                rel="noopener noreferrer" 
                style={{ 
                  display: "inline-flex", 
                  alignItems: "center", 
                  gap: "10px", 
                  background: COLORS.accent, 
                  color: "#fff", 
                  padding: "13px 26px", 
                  borderRadius: "12px", 
                  fontWeight: "700", 
                  fontSize: ".9rem", 
                  boxShadow: `0 4px 20px rgba(43,168,160,.4)`,
                  textDecoration: "none",
                  transition: "background 0.2s"
                }}
                onMouseEnter={(e) => e.target.style.background = "#228B84"}
                onMouseLeave={(e) => e.target.style.background = COLORS.accent}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polygon points="3 11 22 2 13 21 11 13 3 11"/></svg>
                Usar Bot ahora
              </a>
            </div>

            {/* QR de Bot (Centro) */}
            <a 
              href="https://t.me/AIRSUBBOX_BOT" 
              target="_blank" 
              rel="noopener noreferrer"
              style={{ position: "relative", zIndex: 1, flexShrink: 0, padding: "16px", borderRadius: "20px", background: "#fff", border: `1.5px solid ${COLORS.border}`, boxShadow: `0 8px 32px rgba(103,183,232,0.1)`, display: "block" }}
            >
              <img src={qrBotImg} alt="QR Bot" style={{ width: "160px", height: "160px" }}/>
              <div style={{ color: COLORS.primary, fontSize: "0.82rem", fontWeight: "700", textTransform: "uppercase", textAlign: "center", marginTop: "12px" }}>@AIRSUBBOX_BOT</div>
            </a>

            {/* Simulación de Chat de Bot (Derecha - Animado) */}
            <div style={{ position: "relative", zIndex: 1, flex: "1 1 240px", minWidth: "240px", display: "flex", flexDirection: "column", gap: "10px", opacity: 0.9 }}>
              
              {/* Mensaje 1 (Bot) */}
              <div className="chat-bubble chat-bot" style={{ animation: "chat-in .5s ease 0.1s both", display: "flex", flexDirection: "column" }}>
                <div style={{ fontSize: ".58rem", color: "rgba(255,255,255,.4)", marginBottom: "4px" }}>AirSunBox · 09:31</div>
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <div><span style={{ fontSize: "1.1rem" }}>👋</span> ¡Bienvenido a Xela Aire! <br /> Consulta tu zona:</div>
                </div>
                {/* Botones simulados de zona */}
                <div className="zone-btn-grid">
                  {["Zona 1", "Zona 2", "Zona 3", "Zona 4", "Zona 5"].map(z => (
                    <div key={z} className="zone-btn">{z}</div>
                  ))}
                </div>
              </div>

              {/* Mensaje 2 (Usuario) */}
              <div className="chat-bubble chat-user" style={{ animation: "chat-in .5s ease .7s both", display: "flex", flexDirection: "column" }}>
                <div style={{ fontSize: ".58rem", color: "rgba(255,255,255,.6)", marginBottom: "4px" }}>Tú · 09:32</div>
                <div>Mi zona es zona 3. <span className="checks-user">✓✓</span></div>
              </div>

              {/* Mensaje 3 (Bot - Datos) */}
              <div className="chat-bubble chat-bot" style={{ animation: "chat-in .5s ease 1.3s both", display: "flex", flexDirection: "column" }}>
                <div style={{ fontSize: ".58rem", color: "rgba(255,255,255,.4)", marginBottom: "4px" }}>AirSunBox · 09:32</div>
                <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                  <div style={{ width: "36px", height: "36px", borderRadius: "50%", background: "rgba(52,211,153,.15)", border: "2px solid #34D399", display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column" }}>
                    <span style={{ fontSize: "1rem", fontWeight: "900", color: "#34D399", lineHeight: 1 }}>25</span>
                    <span style={{ fontSize: ".42rem", fontWeight: "700", color: "#34D399" }}>AQI</span>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                      <span style={{ color: "#34D399", fontWeight: "800" }}>Buena</span>
                      <span style={{ width: "6px", height: "10px", color: "rgba(255,255,255,0.4)" }}>✓</span>
                    </div>
                    <div style={{ fontSize: ".65rem", color: "rgba(255,255,255,.4)", marginTop: "1px" }}>Zona 3 · Ahora</div>
                  </div>
                </div>
                {/* Detalles de datos */}
                <div style={{ marginTop: "12px", borderTop: "1px solid rgba(255,255,255,0.06)", paddingTop: "8px", display: "grid", gridTemplateColumns: "1fr 1fr", gap: "6px" }}>
                  {[["🌡️ 27.9°C", "Temp"], ["💧 43.8%", "Hum"], ["🫁 522.1 ppm", "CO2"], ["🌫️ 2.4 ppm", "CO"]].map(([val, label]) => (
                    <div key={label} style={{ fontSize: ".68rem" }}>{val} <span style={{ color: "rgba(255,255,255,0.4)" }}>| {label}</span></div>
                  ))}
                </div>
                {/* Estaciones activas */}
                <div style={{ display: "inline-flex", alignItems: "center", gap: "6px", background: "rgba(52,211,153,.15)", border: "1px solid rgba(52,211,153,0.3)", borderRadius: "6px", padding: "3px 8px", marginTop: "12px", fontSize: "0.62rem" }}>
                  <span style={{ width: "5px", height: "5px", borderRadius: "50%", background: "#34D399" }}/>
                  <span style={{ color: "#34D399" }}>Estación Las Américas 3 — AQI 25</span>
                </div>

                {/* NUEVO: BOTÓN CLIQUEABLE REAL DENTRO DEL CHAT SIMULADO HACIA EL MAPA */}
                <a 
                  href="https://voluble-creponne-e6c74f.netlify.app/mapa" 
                  target="_blank" 
                  rel="noopener noreferrer" 
                  style={{ 
                    display: "block", 
                    background: COLORS.primary, 
                    color: "#fff", 
                    textAlign: "center", 
                    padding: "8px 12px", 
                    borderRadius: "8px", 
                    fontSize: "0.75rem", 
                    fontWeight: "700", 
                    marginTop: "12px", 
                    boxShadow: "0 4px 12px rgba(103,183,232,0.3)",
                    textDecoration: "none"
                  }}
                >
                  🗺️ Ver Mapa Público Abierto
                </a>
              </div>

            </div>
          </div>
        </Reveal>
      </section>

      <hr className="divider" style={{ marginTop: "48px" }} />

      {/* STATS */}
      <section style={{ padding: "56px 6vw" }}>
        <div
          className="stats-grid"
          style={{
            maxWidth: 820,
            margin: "0 auto",
            display: "grid",
            gridTemplateColumns: "repeat(3,1fr)",
            gap: 0,
          }}
        >
          {[
            ["9+", "Variables por estación"],
            ["2 años", "Historial almacenado"],
            ["24/7", "Monitoreo continuo"],
          ].map(([n, l], i) => (
            <Reveal key={l} delay={i * 80}>
              <div
                style={{
                  textAlign: "center",
                  padding: "20px 16px",
                  borderRight:
                    i < 2 ? `1px solid ${COLORS.border}` : undefined,
                }}
              >
                <div
                  style={{
                    fontFamily: "'Syne',sans-serif",
                    fontSize: "2.4rem",
                    fontWeight: 800,
                    color: COLORS.primary,
                    lineHeight: 1,
                    marginBottom: 8,
                  }}
                >
                  {n}
                </div>
                <div
                  style={{
                    color: COLORS.textMuted,
                    fontSize: ".85rem",
                    fontWeight: 500,
                  }}
                >
                  {l}
                </div>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      <hr className="divider" />

      {/* SENSORES */}
      <section id="sensores" style={{ padding: "88px 6vw" }}>
        <div style={{ maxWidth: 960, margin: "0 auto" }}>
          <Reveal>
            <p className="section-label">Hardware</p>
            <h2 className="section-title">Estaciones que fabricamos</h2>
            <p className="section-sub" style={{ marginBottom: 40 }}>
              Cada estación es ensamblada con sensores de grado industrial,
              basada en ESP32 y lista para conectarse a tu red WiFi desde el
              primer encendido.
            </p>
          </Reveal>

          <Reveal delay={100}>
            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                gap: 10,
                marginBottom: 40,
              }}
            >
              {SENSORS.map((s) => (
                <span key={s} className="sensor-pill">
                  {s}
                </span>
              ))}
            </div>
          </Reveal>

          <Reveal delay={150}>
            <div
              style={{
                background: "#fff",
                border: `1px solid ${COLORS.border}`,
                borderRadius: 20,
                padding: "40px 32px",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                flexWrap: "wrap",
                gap: 32,
              }}
            >
              <div style={{ flex: "1 1 280px", minWidth: 0 }}>
                <svg
                  viewBox="0 0 320 200"
                  width="100%"
                  style={{ maxWidth: 320 }}
                >
                  <rect
                    x="80"
                    y="20"
                    width="160"
                    height="120"
                    rx="12"
                    fill="rgba(103,183,232,.06)"
                    stroke={COLORS.border}
                    strokeWidth="1.5"
                  />
                  <rect
                    x="130"
                    y="55"
                    width="60"
                    height="40"
                    rx="6"
                    fill={COLORS.primary}
                    opacity=".9"
                  />
                  <text
                    x="160"
                    y="80"
                    textAnchor="middle"
                    fill="#fff"
                    fontSize="9"
                    fontWeight="700"
                    fontFamily="DM Sans,sans-serif"
                  >
                    ESP32
                  </text>
                  {[
                    [100, 40],
                    [220, 40],
                    [100, 120],
                    [220, 120],
                  ].map(([cx, cy], i) => (
                    <g key={i}>
                      <circle cx={cx} cy={cy} r="10" fill={COLORS.border} />
                      <circle
                        cx={cx}
                        cy={cy}
                        r="5"
                        fill={COLORS.accent}
                        opacity=".7"
                      />
                    </g>
                  ))}
                  <text
                    x="160"
                    y="168"
                    textAnchor="middle"
                    fill={COLORS.textMuted}
                    fontSize="10"
                    fontFamily="DM Sans,sans-serif"
                  >
                    WiFi · MQTT · TLS
                  </text>
                  <line
                    x1="160"
                    y1="140"
                    x2="160"
                    y2="155"
                    stroke={COLORS.border}
                    strokeWidth="1.5"
                  />
                </svg>
              </div>

              <div style={{ flex: "1 1 260px", minWidth: 0 }}>
                <h3
                  style={{
                    fontFamily: "'Syne',sans-serif",
                    fontWeight: 800,
                    fontSize: "1.4rem",
                    marginBottom: 12,
                    color: COLORS.text,
                  }}
                >
                  AirSunBox Station v1
                </h3>
                <p
                  style={{
                    color: COLORS.textMuted,
                    fontSize: ".9rem",
                    lineHeight: 1.7,
                    marginBottom: 20,
                  }}
                >
                  Estación compacta y resistente. Mide hasta 9 variables
                  ambientales simultáneamente y las envía a la plataforma constantemente.
                </p>
                <div
                  style={{ display: "flex", flexDirection: "column", gap: 8 }}
                >
                  {[
                    "Instalación en menos de 15 minutos",
                    "Carcasa para exterior IP65",
                    "Actualizaciones OTA automáticas",
                  ].map((f) => (
                    <div
                      key={f}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 10,
                        fontSize: ".875rem",
                        color: COLORS.textMuted,
                      }}
                    >
                      <span
                        style={{
                          color: COLORS.accent,
                          fontWeight: 700,
                          fontSize: "1rem",
                        }}
                      >
                        ✓
                      </span>
                      {f}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      <hr className="divider" />

      {/* CÓMO FUNCIONA */}
      <section
        id="como-funciona"
        style={{
          padding: "88px 6vw",
          background: `linear-gradient(180deg, ${COLORS.bgLight} 0%, rgba(240,247,252,.5) 100%)`,
        }}
      >
        <div style={{ maxWidth: 960, margin: "0 auto" }}>
          <Reveal>
            <p className="section-label">Proceso</p>
            <h2 className="section-title">Simple desde el día uno</h2>
          </Reveal>

          <div
            className="steps-grid"
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(3,1fr)",
              gap: 0,
              marginTop: 56,
            }}
          >
            {STEPS.map(({ n, title, desc }, i) => (
              <Reveal key={n} delay={i * 100}>
                <div
                  style={{
                    padding: "0 32px 0 0",
                    borderRight:
                      i < 2 ? `1px solid ${COLORS.border}` : undefined,
                    paddingLeft: i > 0 ? 32 : 0,
                    paddingRight: i < 2 ? 32 : 0,
                  }}
                >
                  <div className="step-number">{n}</div>
                  <h3
                    style={{
                      fontFamily: "'Syne',sans-serif",
                      fontWeight: 700,
                      fontSize: "1.05rem",
                      marginBottom: 10,
                      color: COLORS.text,
                    }}
                  >
                    {title}
                  </h3>
                  <p
                    style={{
                      color: COLORS.textMuted,
                      fontSize: ".875rem",
                      lineHeight: 1.7,
                    }}
                  >
                    {desc}
                  </p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      <hr className="divider" />

      {/* FEATURES */}
      <section
        id="funcionalidades"
        style={{ padding: "88px 6vw", background: "#fff" }}
      >
        <div style={{ maxWidth: 1000, margin: "0 auto" }}>
          <Reveal>
            <p className="section-label">Plataforma</p>
            <h2 className="section-title">Todo lo que necesitás</h2>
            <p className="section-sub" style={{ marginBottom: 56 }}>
              La plataforma centraliza tus estaciones, visualiza datos y te
              avisa cuando algo sale de rango.
            </p>
          </Reveal>

          <div
            className="features-grid"
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit,minmax(280px,1fr))",
              gap: 16,
            }}
          >
            {FEATURES.map(({ icon, title, desc }, i) => (
              <Reveal key={title} delay={i * 60}>
                <div className="feature-card">
                  <div
                    style={{
                      width: 44,
                      height: 44,
                      background: `rgba(103,183,232,.1)`,
                      borderRadius: 12,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: "1.3rem",
                      marginBottom: 16,
                    }}
                  >
                    {icon}
                  </div>
                  <h3
                    style={{
                      fontWeight: 600,
                      fontSize: "1rem",
                      marginBottom: 8,
                      color: COLORS.text,
                    }}
                  >
                    {title}
                  </h3>
                  <p
                    style={{
                      color: COLORS.textMuted,
                      fontSize: ".875rem",
                      lineHeight: 1.65,
                    }}
                  >
                    {desc}
                  </p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      <hr className="divider" />

      {/* PRECIOS */}
      <section id="precios" style={{ padding: "88px 6vw" }}>
        <div style={{ maxWidth: 960, margin: "0 auto" }}>
          <Reveal>
            <p className="section-label">Apoyo</p>
            <h2 className="section-title">Suscripción anual al cambio</h2>
            <p className="section-sub" style={{ marginBottom: 56 }}>
              Únase al consorcio de empresas que financian la red de monitoreo. Una inversión con retorno de visibilidad, datos e impacto ambiental real en Quetzaltenango.
            </p>
          </Reveal>

          <div
            className="plans-grid"
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit,minmax(260px,1fr))",
              gap: 20,
              alignItems: "start",
            }}
          >
            {PLANS.map((p, i) => (
              <Reveal key={p.name} delay={i * 80}>
                <div
                  className={`plan-card ${p.popular ? "plan-popular" : ""}`}
                >
                  {p.popular && (
                    <div
                      style={{
                        position: "absolute",
                        top: -13,
                        left: "50%",
                        transform: "translateX(-50%)",
                        background: COLORS.primary,
                        color: "#fff",
                        padding: "4px 18px",
                        borderRadius: 99,
                        fontSize: ".72rem",
                        fontWeight: 700,
                        letterSpacing: ".05em",
                        textTransform: "uppercase",
                        whiteSpace: "nowrap",
                      }}
                    >
                    </div>
                  )}

                  <div
                    style={{
                      fontFamily: "'Syne',sans-serif",
                      fontWeight: 800,
                      fontSize: "1.1rem",
                      color: COLORS.text,
                      marginBottom: 4,
                    }}
                  >
                    {p.name}
                  </div>
                  <div
                    style={{
                      color: COLORS.textMuted,
                      fontSize: ".82rem",
                      marginBottom: 20,
                    }}
                  >
                    {p.desc}
                  </div>

                  <div
                    style={{
                      display: "flex",
                      alignItems: "baseline",
                      gap: 4,
                      marginBottom: 24,
                    }}
                  >
                    <span
                      style={{
                        fontFamily: "'Syne',sans-serif",
                        fontSize: "2rem",
                        fontWeight: 800,
                        color: p.popular ? COLORS.primary : COLORS.text,
                      }}
                    >
                      {p.price}
                    </span>
                    {p.period && (
                      <span
                        style={{ color: COLORS.textMuted, fontSize: ".85rem" }}
                      >
                        {p.period}
                      </span>
                    )}
                  </div>

                  <div
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      gap: 10,
                      marginBottom: 28,
                      paddingTop: 20,
                      borderTop: `1px solid ${COLORS.border}`,
                    }}
                  >
                    {p.features.map((f) => (
                      <div
                        key={f}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 10,
                          fontSize: ".875rem",
                          color: COLORS.textMuted,
                        }}
                      >
                        <span
                          style={{
                            color: COLORS.accent,
                            fontWeight: 700,
                            fontSize: "1rem",
                            flexShrink: 0,
                          }}
                        >
                          ✓
                        </span>
                        {f}
                      </div>
                    ))}
                  </div>

                  <a
                    href="mailto:AirSunBox@gmail.com"
                    className={p.popular ? "btn-primary" : "btn-outline"}
                    style={{
                      display: "block",
                      textAlign: "center",
                      width: "100%",
                      justifyContent: "center",
                    }}
                  >
                    {p.cta}
                  </a>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      <hr className="divider" />

      {/* CTA FINAL */}
      <section
        style={{
          padding: "96px 6vw",
          textAlign: "center",
          background: `linear-gradient(135deg, rgba(103,183,232,.06) 0%, rgba(43,168,160,.06) 100%)`,
        }}
      >
        <Reveal>
          <div style={{ marginBottom: 16, display: "flex", justifyContent: "center" }}>
            <AirSunBoxLogo size={180} />
          </div>
          <h2
            style={{
              fontFamily: "'Syne',sans-serif",
              fontSize: "clamp(1.8rem,3.5vw,2.8rem)",
              fontWeight: 800,
              lineHeight: 1.15,
              marginBottom: 16,
              color: COLORS.text,
            }}
          >
            ¿Listo para empezar a 
            <br />
            cambiar y ser parte de la revolución ambiental?
          </h2>
          <p
            style={{
              color: COLORS.textMuted,
              fontSize: "1rem",
              lineHeight: 1.7,
              marginBottom: 40,
              maxWidth: 440,
              margin: "0 auto 40px",
            }}
          >
            Te instalamos la primera estación y la tenés funcionando en menos
            de una semana.
          </p>

          <div
            style={{
              display: "flex",
              gap: 14,
              justifyContent: "center",
              flexWrap: "wrap",
            }}
          >
            <a
              href="https://wa.me/50256278637?text=Hola%20AirSunBox%2C%20quiero%20saber%20más%20sobre%20sus%20planes%20y%20estaciones."
              className="btn-primary"
              style={{ fontSize: "1rem", padding: "14px 36px" }}
            >
              WhatsApp
            </a>
            <a
              href="mailto:AirSunBox@gmail.com"
              className="btn-outline"
              style={{ fontSize: "1rem", padding: "14px 36px" }}
            >
              AirSunBox@gmail.com
            </a>
          </div>
        </Reveal>
      </section>

      {/* FOOTER */}
      <footer
        style={{
          borderTop: `1px solid ${COLORS.border}`,
          padding: "28px 6vw",
        }}
      >
        <div
          className="footer-inner"
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            flexWrap: "wrap",
            gap: 16,
            maxWidth: 1100,
            margin: "0 auto",
          }}
        >
          <AirSunBoxLogo size={110} />

          <p
            style={{
              color: COLORS.textMuted,
              fontSize: "0.82rem",
            }}
          >
            © {new Date().getFullYear()} AirSunBox · Monitoreo ambiental para Guatemala
          </p>

          <div style={{ display: "flex", gap: 24 }}>
            {/* ENLACE AL MAPA EN EL FOOTER TAMBIÉN */}
            <a
              href="https://voluble-creponne-e6c74f.netlify.app/mapa"
              target="_blank"
              rel="noopener noreferrer"
              style={{
                color: COLORS.textMuted,
                fontSize: ".85rem",
                transition: "color .2s",
              }}
            >
              Mapa Público
            </a>
            <Link
              to="/login"
              style={{
                color: COLORS.textMuted,
                fontSize: ".85rem",
                transition: "color .2s",
              }}
            >
              Ingresar
            </Link>
            <a
              href="mailto:AirSunBox@gmail.com"
              style={{
                color: COLORS.textMuted,
                fontSize: ".85rem",
                transition: "color .2s",
              }}
            >
              Contacto
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}