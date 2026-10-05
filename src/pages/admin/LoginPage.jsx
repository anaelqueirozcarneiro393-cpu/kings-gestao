import React, { useState } from 'react';
import { User, Lock, Eye, EyeOff, ArrowRight, ShieldCheck, KeyRound } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

export function LoginPage({ onBackToMenu }) {
  const { login } = useAuth();
  const [username, setUsername] = useState('admin');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const success = await login({ username: username.trim(), password: password.trim() });
      if (!success) {
        setError('Usuário ou senha incorretos.');
      }
    } catch (err) {
      setError(err.message || 'Erro ao realizar login.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0b0f17] flex items-center justify-center p-4">
      <div className="w-full max-w-sm space-y-6">
        {/* Logo / Header */}
        <div className="text-center space-y-2">
          <div className="w-12 h-12 rounded-2xl bg-amber-500 flex items-center justify-center font-black text-slate-950 text-2xl mx-auto shadow-xl shadow-amber-500/25">
            K
          </div>
          <h1 className="text-xl font-black text-slate-100 tracking-wider">KING'S GESTÃO</h1>
          <p className="text-xs text-slate-400">
            Acesso Restrito do Proprietário • Painel /admin
          </p>
        </div>

        {/* Card do Formulário */}
        <div className="p-6 rounded-2xl border border-slate-800 bg-slate-900/90 shadow-2xl backdrop-blur-sm space-y-5">
          <div className="flex items-center gap-2 p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-300 text-[11px]">
            <ShieldCheck className="w-4 h-4 text-amber-400 shrink-0" />
            <span>Área administrativa protegida com autenticação de segurança.</span>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Campo Usuário / Login */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                Usuário / Login
              </label>
              <div className="relative">
                <User className="absolute left-3.5 top-3 w-4 h-4 text-slate-500" />
                <input
                  type="text"
                  required
                  autoFocus
                  placeholder="admin"
                  value={username}
                  onChange={e => setUsername(e.target.value)}
                  className="w-full pl-10 pr-3 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-sm text-slate-100 placeholder-slate-600 focus:outline-none focus:border-amber-500/50 font-medium"
                />
              </div>
            </div>

            {/* Campo Senha Forte */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                Senha de Acesso
              </label>
              <div className="relative">
                <Lock className="absolute left-3.5 top-3 w-4 h-4 text-slate-500" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  placeholder="Digite a senha forte"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  className="w-full pl-10 pr-10 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-sm text-slate-100 placeholder-slate-600 focus:outline-none focus:border-amber-500/50 font-mono"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-2.5 text-slate-500 hover:text-slate-300 transition-colors p-0.5 cursor-pointer"
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {error && (
              <div className="p-2.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading || !username || !password}
              className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-slate-950 font-bold text-xs shadow-lg shadow-amber-500/20 active:scale-[0.98] transition-all cursor-pointer"
            >
              <span>{loading ? 'Autenticando...' : 'Entrar no Painel'}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>

          <div className="pt-3 border-t border-slate-800 text-center">
            <button
              onClick={onBackToMenu}
              className="text-xs text-slate-400 hover:text-amber-300 transition-colors cursor-pointer"
            >
              Voltar ao Cardápio Digital
            </button>
          </div>
        </div>

        <div className="text-center text-[11px] text-slate-500">
          KING'S AÇAÍ • KING'S BURGUER • KING'S PIZZA
        </div>
      </div>
    </div>
  );
}
