import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { createPortal } from 'react-dom';
import {
  Menu, X, Home, Heart, Clock, MessageSquare, LogOut,
  Moon, Sun, Type, Bookmark, Search
} from 'lucide-react';
import { authService } from '../models/api/authService';
import { useLogout } from '../controllers/hooks/useLogout';

const SideMenu: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [user, setUser] = useState<any>(() => {
    const cached = localStorage.getItem('devorapp_user_cache');
    try {
      return cached ? JSON.parse(cached) : null;
    } catch {
      return null;
    }
  });
  
  const navigate = useNavigate();
  const location = useLocation();
  const { submitLogout } = useLogout(() => {
    localStorage.removeItem('devorapp_user_cache');
    setIsOpen(false);
    navigate('/login');
  });

  const [theme, setTheme] = useState<'dark' | 'light'>(() => {
    return (localStorage.getItem('devorapp_theme') as 'dark' | 'light') || 'dark';
  });
  const [fontSize, setFontSize] = useState<'S' | 'M' | 'L'>(() => {
    return (localStorage.getItem('devorapp_fontsize') as 'S' | 'M' | 'L') || 'M';
  });

  // Aplicar tema real al documento
  useEffect(() => {
    if (theme === 'light') {
      document.documentElement.dataset.theme = 'light';
    } else {
      delete document.documentElement.dataset.theme;
    }
    localStorage.setItem('devorapp_theme', theme);
  }, [theme]);

  // Aplicar tamaño de letra real al documento
  useEffect(() => {
    if (fontSize === 'M') {
      delete document.documentElement.dataset.fontSize;
    } else {
      document.documentElement.dataset.fontSize = fontSize;
    }
    localStorage.setItem('devorapp_fontsize', fontSize);
  }, [fontSize]);

  useEffect(() => {
    // Carga inicial ansiosa para actualizar cache y estado
    authService.getMe().then(data => {
      setUser(data);
      localStorage.setItem('devorapp_user_cache', JSON.stringify(data));
    }).catch(() => {
      // Si falla (ej. sesión expirada), limpiamos caché
      localStorage.removeItem('devorapp_user_cache');
    });
  }, []);

  useEffect(() => {
    const handleUserUpdate = (e: any) => {
      setUser(e.detail);
    };
    globalThis.addEventListener('userUpdated', handleUserUpdate);
    return () => globalThis.removeEventListener('userUpdated', handleUserUpdate);
  }, []);

  const closeMenu = () => setIsOpen(false);

  const goTo = (path: string) => {
    closeMenu();
    navigate(path);
  };

  const getInitials = (n?: string, u?: string) => {
    if (n) return n.charAt(0).toUpperCase();
    if (u) return u.charAt(0).toUpperCase();
    return '?';
  };

  const menuContent = (
    <div className={`sidemenu-overlay ${isOpen ? 'open' : ''}`}>
      <div className="sidemenu-backdrop" onClick={closeMenu} aria-hidden="true" />
      <aside className="sidemenu-drawer">
         <div className="sidemenu-header">
           <span className="sidemenu-brand">DevorApp</span>
           <button className="sidemenu-close" onClick={closeMenu} aria-label="Cerrar menú">
             <X size={22} />
           </button>
         </div>

         {user && (
           <button
             className="sidemenu-user"
             onClick={() => goTo('/profile')}
             onKeyDown={(e) => e.key === 'Enter' && goTo('/profile')}
             style={{ cursor: 'pointer', background: 'none', border: 'none', width: '100%', textAlign: 'left', padding: 0 }}
           >
             <div className="sidemenu-avatar">
               {getInitials(user.nombre, user.username)}
             </div>
             <div className="sidemenu-user-info">
               <span className="sidemenu-user-name">
                 {user.nombre ? `${user.nombre} ${user.apellidos || ''}`.trim() : user.username}
               </span>
               <span className="sidemenu-user-email">{user.email}</span>
             </div>
           </button>
         )}

         <nav className="sidemenu-nav">
           <button className={`sidemenu-item ${location.pathname==='/home'?'active':''}`} onClick={()=>goTo('/home')} style={{ '--idx': 0 } as React.CSSProperties}>
             <Home size={18} /> Inicio
           </button>
           <button className={`sidemenu-item ${location.pathname==='/recommend-restaurants'?'active':''}`} onClick={()=>goTo('/recommend-restaurants')} style={{ '--idx': 1 } as React.CSSProperties}>
             <Search size={18} /> Buscador
           </button>
           <button className={`sidemenu-item ${location.pathname==='/favorites'?'active':''}`} onClick={()=>goTo('/favorites')} style={{ '--idx': 2 } as React.CSSProperties}>
             <Heart size={18} /> Favoritos
           </button>
           <button className={`sidemenu-item ${location.pathname==='/saved-for-later'?'active':''}`} onClick={()=>goTo('/saved-for-later')} style={{ '--idx': 3 } as React.CSSProperties}>
             <Bookmark size={18} /> Para más tarde
           </button>
           <button className={`sidemenu-item ${location.pathname==='/history'?'active':''}`} onClick={()=>goTo('/history')} style={{ '--idx': 4 } as React.CSSProperties}>
             <Clock size={18} /> Historial
           </button>
           <button className={`sidemenu-item ${location.pathname==='/mis-valoraciones'?'active':''}`} onClick={()=>goTo('/mis-valoraciones')} style={{ '--idx': 5 } as React.CSSProperties}>
             <MessageSquare size={18} /> Valoraciones
           </button>
         </nav>

         {/* Controles de apariencia abstractos */}
         <div className="sidemenu-settings">
           <div className="sidemenu-setting">
             <span className="sidemenu-setting-label">Tema</span>
             <div className="sidemenu-toggle-group">
               <button className={theme==='light'?'active':''} onClick={()=>setTheme('light')}>
                 <Sun size={14}/> Claro
               </button>
               <button className={theme==='dark'?'active':''} onClick={()=>setTheme('dark')}>
                 <Moon size={14}/> Oscuro
               </button>
             </div>
           </div>
           
           <div className="sidemenu-setting">
             <span className="sidemenu-setting-label">Letra <Type size={14} style={{marginLeft: 4, verticalAlign: 'middle', opacity: 0.5}}/></span>
             <div className="sidemenu-toggle-group">
               <button className={fontSize==='S'?'active':''} onClick={()=>setFontSize('S')}>S</button>
               <button className={fontSize==='M'?'active':''} onClick={()=>setFontSize('M')}>M</button>
               <button className={fontSize==='L'?'active':''} onClick={()=>setFontSize('L')}>L</button>
             </div>
           </div>
         </div>

         <div className="sidemenu-footer">
           <button className="sidemenu-logout" onClick={submitLogout}>
             <LogOut size={18} /> Cerrar sesión
           </button>
         </div>
      </aside>
    </div>
  );

  return (
    <>
      <button className="topbar-menu-btn" onClick={() => setIsOpen(true)} aria-label="Abrir menú">
        <Menu size={24} />
      </button>
      {/* Mapea el menú al final del body para no ser clip-eado por contadores */}
      {createPortal(menuContent, document.body)}
    </>
  );
};

export default SideMenu;
