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
    <div className="min-h-screen w-screen flex flex-col justify-center items-center bg-[#0a0a0f] px-4 relative overflow-hidden">
      {/* Background effects */}
      <div className="absolute top-[-30%] right-[-15%] w-[500px] h-[500px] rounded-full bg-indigo-600/8 blur-[120px]" />
      <div className="absolute bottom-[-20%] left-[-10%] w-[400px] h-[400px] rounded-full bg-violet-600/8 blur-[120px]" />

      <div className="relative z-10 w-full max-w-[420px] animate-slide-up">
        {/* Logo */}
        <Link href="/" className="flex items-center justify-center gap-2 mb-8 group">
          <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center">
            <Pen className="w-4 h-4 text-white" />
          </div>
          <span className="text-xl font-bold text-white">Inkspace</span>
        </Link>

        {/* Card */}
        <div className="bg-white/[0.03] border border-white/[0.08] rounded-2xl p-8 backdrop-blur-sm">
          <h1 className="text-2xl font-bold text-white mb-1 text-center">
            {isSignin ? "Welcome back" : "Create your account"}
          </h1>
          <p className="text-sm text-gray-500 mb-6 text-center">
            {isSignin ? "Sign in to continue to your workspace" : "Get started with Inkspace for free"}
          </p>

          {serverError && (
            <div className="w-full p-3 mb-4 bg-red-500/10 border border-red-500/20 rounded-xl text-red-300 text-sm flex items-center gap-2">
              <div className="w-1.5 h-1.5 rounded-full bg-red-400 shrink-0" />
              {serverError}
            </div>
          )}

          <form onSubmit={handleSubmit} className="flex flex-col gap-3.5">
            {/* Username - always shown */}
            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1.5">Username</label>
              <input 
                className="w-full px-3.5 py-2.5 bg-white/[0.04] border border-white/[0.08] text-white rounded-xl text-sm placeholder:text-gray-600 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500/50 transition-all disabled:opacity-50" 
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
                <label className="block text-xs font-medium text-gray-400 mb-1.5">Email</label>
                <input 
                  className="w-full px-3.5 py-2.5 bg-white/[0.04] border border-white/[0.08] text-white rounded-xl text-sm placeholder:text-gray-600 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500/50 transition-all disabled:opacity-50" 
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
              <label className="block text-xs font-medium text-gray-400 mb-1.5">Password</label>
              <div className="relative">
                <input 
                  className="w-full px-3.5 py-2.5 pr-10 bg-white/[0.04] border border-white/[0.08] text-white rounded-xl text-sm placeholder:text-gray-600 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500/50 transition-all disabled:opacity-50" 
                  type={showPassword ? "text" : "password"}
                  placeholder={isSignin ? "Enter your password" : "Min 6 chars, Aa1@"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={loading}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300 transition-colors"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {errors.password && (
                <p className="text-red-400 text-xs mt-1.5">{errors.password}</p>
              )}
              {!isSignin && !errors.password && (
                <p className="text-gray-600 text-xs mt-1.5">Uppercase, lowercase, number & special character required</p>
              )}
            </div>

            <button 
              className="mt-1 flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:hover:bg-indigo-600 p-2.5 w-full rounded-xl text-white text-sm font-semibold transition-all shadow-lg shadow-indigo-600/20" 
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
        <p className="text-center text-gray-500 text-sm mt-6">
          {isSignin ? "Don\u2019t have an account? " : "Already have an account? "}
          <Link 
            href={isSignin ? "/signup" : "/signin"} 
            className="text-indigo-400 hover:text-indigo-300 font-medium transition-colors"
          >
            {isSignin ? "Sign up" : "Sign in"}
          </Link>
        </p>
      </div>
    </div>
  );
}