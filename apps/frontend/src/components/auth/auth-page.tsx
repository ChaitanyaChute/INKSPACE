"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import axios from "axios";
import { API_URL } from "@/config";
import { Pen, Loader2, Eye, EyeOff } from "lucide-react";

interface AuthPageProps {
  isSignin: boolean
}

export default function AuthPage ({isSignin}: AuthPageProps) {
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [serverError, setServerError] = useState("");
  const router = useRouter();

  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    if (username.length < 3) {
      newErrors.username = "Username must be at least 3 characters";
    } else if (username.length > 20) {
      newErrors.username = "Username must be at most 20 characters";
    }

    if (!isSignin) {
      if (!email) {
        newErrors.email = "Email is required";
      } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        newErrors.email = "Invalid email address";
      }

      if (password.length < 6) {
        newErrors.password = "Password must be at least 6 characters";
      } else if (!/[A-Z]/.test(password)) {
        newErrors.password = "Must contain uppercase letter";
      } else if (!/[a-z]/.test(password)) {
        newErrors.password = "Must contain lowercase letter";
      } else if (!/[0-9]/.test(password)) {
        newErrors.password = "Must contain a number";
      } else if (!/[@$!%*?&]/.test(password)) {
        newErrors.password = "Must contain special character";
      }
    } else {
      if (!password) {
        newErrors.password = "Password is required";
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setServerError("");

    if (!validateForm()) {
      return;
    }

    setLoading(true);

    try {
      const endpoint = isSignin ? "/signin" : "/signup";
      const payload = isSignin
        ? { username, password }
        : { username, email, password };

      const response = await axios.post(`${API_URL}${endpoint}`, payload);

      if (isSignin) {
        localStorage.setItem("token", response.data.token);
        router.push("/dashboard");
      } else {
        router.push("/signin");
      }
    } catch (error: any) {
      if (error.response?.data?.message) {
        setServerError(error.response.data.message);
      } else if (error.response?.data?.errors) {
        setServerError(error.response.data.errors[0].message);
      } else {
        setServerError("An error occurred. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-screen flex flex-col justify-center items-center bg-[#0b0b0a] px-4 relative overflow-hidden noise">
      {/* Background effects */}
      <div className="absolute top-[-30%] right-[-15%] w-[500px] h-[500px] rounded-full bg-[#ff7448]/10 blur-[120px]" />
      <div className="absolute bottom-[-20%] left-[-10%] w-[400px] h-[400px] rounded-full bg-[#d7a86e]/10 blur-[120px]" />

      <div className="relative z-10 w-full max-w-[420px] animate-slide-up">
        {/* Logo */}
        <Link href="/" className="flex items-center justify-center gap-2 mb-8 group">
          <div className="w-8 h-8 rounded-full bg-[#f3efe6] flex items-center justify-center">
            <Pen className="w-4 h-4 text-[#171714]" />
          </div>
          <span className="text-xl font-semibold tracking-[-0.04em] text-[#f3efe6]">inkspace<span className="text-[#ff7448]">.</span></span>
        </Link>

        {/* Card */}
        <div className="bg-[#f3efe6] border border-white/10 rounded-[1.75rem] p-8 shadow-2xl shadow-black/20">
          <h1 className="text-2xl font-semibold tracking-[-0.04em] text-[#171714] mb-1 text-center">
            {isSignin ? "Welcome back" : "Create your account"}
          </h1>
          <p className="text-sm text-[#817d73] mb-6 text-center">
            {isSignin ? "Sign in to continue to your workspace" : "Get started with Inkspace for free"}
          </p>

          {serverError && (
            <div className="w-full p-3 mb-4 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm flex items-center gap-2">
              <div className="w-1.5 h-1.5 rounded-full bg-red-500 shrink-0" />
              {serverError}
            </div>
          )}

          <form onSubmit={handleSubmit} className="flex flex-col gap-3.5">
            {/* Username - always shown */}
            <div>
              <label className="block text-xs font-medium text-[#514e47] mb-1.5">Username</label>
              <input 
                className="w-full px-3.5 py-2.5 bg-white/70 border border-[#d8d1c4] text-[#171714] rounded-xl text-sm placeholder:text-[#aaa397] focus:outline-none focus:ring-2 focus:ring-[#ff7448]/30 focus:border-[#ff7448] transition-all disabled:opacity-50" 
                type="text" 
                placeholder="Enter your username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                disabled={loading}
              />
              {errors.username && (
                <p className="text-red-400 text-xs mt-1.5">{errors.username}</p>
              )}
            </div>

            {/* Email - signup only */}
            {!isSignin && (
              <div>
                <label className="block text-xs font-medium text-[#514e47] mb-1.5">Email</label>
                <input 
                  className="w-full px-3.5 py-2.5 bg-white/70 border border-[#d8d1c4] text-[#171714] rounded-xl text-sm placeholder:text-[#aaa397] focus:outline-none focus:ring-2 focus:ring-[#ff7448]/30 focus:border-[#ff7448] transition-all disabled:opacity-50" 
                  type="email" 
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={loading}
                />
                {errors.email && (
                  <p className="text-red-400 text-xs mt-1.5">{errors.email}</p>
                )}
              </div>
            )}

            {/* Password */}
            <div>
              <label className="block text-xs font-medium text-[#514e47] mb-1.5">Password</label>
              <div className="relative">
                <input 
                  className="w-full px-3.5 py-2.5 pr-10 bg-white/70 border border-[#d8d1c4] text-[#171714] rounded-xl text-sm placeholder:text-[#aaa397] focus:outline-none focus:ring-2 focus:ring-[#ff7448]/30 focus:border-[#ff7448] transition-all disabled:opacity-50" 
                  type={showPassword ? "text" : "password"}
                  placeholder={isSignin ? "Enter your password" : "Min 6 chars, Aa1@"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={loading}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[#817d73] hover:text-[#171714] transition-colors"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {errors.password && (
                <p className="text-red-400 text-xs mt-1.5">{errors.password}</p>
              )}
              {!isSignin && !errors.password && (
                <p className="text-[#aaa397] text-xs mt-1.5">Uppercase, lowercase, number & special character required</p>
              )}
            </div>

            <button 
              className="mt-1 flex items-center justify-center gap-2 bg-[#171714] hover:bg-[#ff7448] disabled:opacity-50 p-2.5 w-full rounded-xl text-[#f3efe6] text-sm font-semibold transition-all shadow-lg shadow-black/10" 
              type="submit"
              disabled={loading}
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  {isSignin ? "Signing in..." : "Creating account..."}
                </>
              ) : (
                isSignin ? "Sign In" : "Create Account"
              )}
            </button>
          </form>
        </div>

        {/* Footer link */}
        <p className="text-center text-white/45 text-sm mt-6">
          {isSignin ? "Don\u2019t have an account? " : "Already have an account? "}
          <Link 
            href={isSignin ? "/signup" : "/signin"} 
            className="text-[#ff9a76] hover:text-[#ff7448] font-medium transition-colors"
          >
            {isSignin ? "Sign up" : "Sign in"}
          </Link>
        </p>
      </div>
    </div>
  );
}