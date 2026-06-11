"use client";

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Mail, Lock, Eye, EyeOff, Loader2, AlertCircle, CheckCircle2, ShieldCheck, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import api from '@/lib/axios';
import { toast } from 'sonner';
import { OTPInput, SlotProps } from 'input-otp';
import { cn } from '@/lib/utils';

export default function ForgotPasswordPage() {
  const router = useRouter();
  const [step, setStep] = useState<'email' | 'otp' | 'reset'>('email');
  const [email, setEmail] = useState('');
  const [otpValue, setOtpValue] = useState('');
  const [resetToken, setResetToken] = useState<string | null>(null);
  
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Cooldown rate limiter: 60 seconds
  const [cooldown, setCooldown] = useState(0);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  const startCooldown = () => {
    setCooldown(60);
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      setCooldown((prev) => {
        if (prev <= 1) {
          if (timerRef.current) clearInterval(timerRef.current);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  const handleRequestOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !email.includes('@')) {
      setErrorMsg('Please enter a valid email address');
      return;
    }

    setIsLoading(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      const response = await api.post('/auth/forgot-password', { email });
      setSuccessMsg(response.data.message || 'If an account with that email exists, you will receive a reset code shortly.');
      startCooldown();
      setStep('otp');
    } catch (err: any) {
      console.error('Request OTP failed:', err);
      let message = 'Failed to request verification code. Please try again.';
      if (err.response?.data?.message) {
        message = err.response.data.message;
      }
      setErrorMsg(Array.isArray(message) ? message[0] : message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleResendOtp = async () => {
    if (cooldown > 0) return;
    
    setIsLoading(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      const response = await api.post('/auth/forgot-password', { email });
      setSuccessMsg(response.data.message || 'Verification code resent successfully.');
      startCooldown();
    } catch (err: any) {
      console.error('Resend OTP failed:', err);
      let message = 'Failed to resend verification code.';
      if (err.response?.data?.message) {
        message = err.response.data.message;
      }
      setErrorMsg(Array.isArray(message) ? message[0] : message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    if (otpValue.length < 6) {
      setErrorMsg('Please enter all 6 digits of the verification code.');
      return;
    }

    setIsLoading(true);
    try {
      const response = await api.post('/auth/verify-otp', {
        email,
        otp: otpValue,
      });

      const token = response.data.resetToken;
      setResetToken(token);
      setSuccessMsg('Code verified successfully.');
      setStep('reset');
    } catch (err: any) {
      console.error('Verify OTP failed:', err);
      let message = 'Failed to verify code. Please try again.';
      if (err.response?.data?.message) {
        message = err.response.data.message;
      }
      setErrorMsg(Array.isArray(message) ? message[0] : message);
      setOtpValue(''); // Clear input on error
    } finally {
      setIsLoading(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    if (!resetToken) {
      setErrorMsg('Session expired. Please start over.');
      setStep('email');
      return;
    }

    if (newPassword.length < 6) {
      setErrorMsg('Password must be at least 6 characters long.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setErrorMsg('Passwords do not match.');
      return;
    }

    setIsLoading(true);
    try {
      const response = await api.post('/auth/reset-password', {
        resetToken,
        newPassword,
        confirmPassword,
      });

      setSuccessMsg(response.data.message || 'Password reset successfully.');
      toast.success('Password reset successfully. Please sign in.');
      setTimeout(() => {
        router.push('/login');
      }, 2000);
    } catch (err: any) {
      console.error('Reset password failed:', err);
      let message = 'Failed to reset password. Please try again.';
      if (err.response?.data?.message) {
        message = err.response.data.message;
      }
      setErrorMsg(Array.isArray(message) ? message[0] : message);
      
      // If the token is invalid/expired, redirect back to Step 1
      if (err.response?.status === 401 || err.response?.status === 400) {
        setTimeout(() => {
          setResetToken(null);
          setStep('email');
          setErrorMsg('Session expired. Please start over.');
        }, 1500);
      }
    } finally {
      setIsLoading(false);
    }
  };

  // Helper Slot component for input-otp
  function Slot(props: SlotProps) {
    return (
      <div
        className={cn(
          "relative w-12 h-12 text-center text-lg font-bold border-slate-200 dark:border-slate-800 border rounded-md focus-visible:ring-indigo-500 bg-white dark:bg-slate-950 shadow-sm flex items-center justify-center transition-all",
          props.isActive && "ring-2 ring-indigo-500 outline-none border-indigo-500",
        )}
      >
        {props.char !== null && <div className="font-mono">{props.char}</div>}
        {props.hasFakeCaret && (
          <div className="absolute pointer-events-none inset-0 flex items-center justify-center animate-pulse">
            <div className="w-0.5 h-6 bg-slate-900 dark:bg-slate-50" />
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 dark:bg-slate-950 px-4 py-12 sm:px-6 lg:px-8 relative overflow-hidden">
      {/* Decorative background blobs */}
      <div className="absolute top-0 -left-4 w-72 h-72 bg-indigo-500 rounded-full mix-blend-multiply filter blur-xl opacity-10 animate-blob" />
      <div className="absolute top-0 -right-4 w-72 h-72 bg-purple-500 rounded-full mix-blend-multiply filter blur-xl opacity-10 animate-blob animation-delay-2000" />

      <Card className="w-full max-w-md border-slate-200 dark:border-slate-800/80 bg-white/90 dark:bg-slate-900/90 backdrop-blur-md shadow-2xl relative z-10">
        <CardHeader className="space-y-2 text-center pb-6">
          <div className="flex items-center justify-center gap-2 text-indigo-600 dark:text-indigo-400 mb-2">
            <ShieldCheck className="size-8 animate-pulse" />
            <span className="text-2xl font-black tracking-tight">CollabNotes</span>
          </div>
          <CardTitle className="text-xl font-bold tracking-tight">
            {step === 'email' && 'Forgot Password?'}
            {step === 'otp' && 'Check Your Email'}
            {step === 'reset' && 'Set New Password'}
          </CardTitle>
          <CardDescription className="text-slate-500 dark:text-slate-400">
            {step === 'email' && 'Enter your email below and we will send you a 6-digit code to reset your password.'}
            {step === 'otp' && `We sent a 6-digit code to ${email}.`}
            {step === 'reset' && 'Almost done. Enter your new password below.'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {step === 'email' && (
            <form onSubmit={handleRequestOtp} className="space-y-4">
              {/* Email Address */}
              <div className="space-y-1.5">
                <Label htmlFor="email">Email Address</Label>
                <div className="relative">
                  <Input
                    id="email"
                    type="email"
                    placeholder="name@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    className="pl-10 border-slate-200 dark:border-slate-800 focus-visible:ring-indigo-500"
                  />
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 size-4" />
                </div>
              </div>

              {/* Submit Request */}
              <Button
                type="submit"
                disabled={isLoading}
                className="w-full font-semibold bg-indigo-600 hover:bg-indigo-700 text-white shadow-lg shadow-indigo-500/10 transition-colors mt-2"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 size-4 animate-spin" />
                    Sending OTP...
                  </>
                ) : (
                  'Send Reset Code'
                )}
              </Button>

              <div className="text-center text-xs mt-2">
                <Link href="/login" className="text-indigo-600 dark:text-indigo-400 hover:underline font-semibold">
                  Remember your password? Sign in
                </Link>
              </div>
            </form>
          )}

          {step === 'otp' && (
            <form onSubmit={handleVerifyOtp} className="space-y-4">
              {/* OTP Input using input-otp */}
              <div className="space-y-2 flex flex-col items-center">
                <Label className="self-start">Verification Code</Label>
                <OTPInput
                  maxLength={6}
                  value={otpValue}
                  onChange={setOtpValue}
                  containerClassName="flex items-center justify-center gap-2"
                  render={({ slots }) => (
                    <div className="flex justify-between gap-2">
                      {slots.map((slot, idx) => (
                        <Slot key={idx} {...slot} />
                      ))}
                    </div>
                  )}
                />
              </div>

              {/* Cooldown/Resend */}
              <div className="flex items-center justify-between text-xs mt-2">
                <button
                  type="button"
                  onClick={handleResendOtp}
                  disabled={cooldown > 0 || isLoading}
                  className={cn(
                    "flex items-center gap-1 font-semibold transition-colors",
                    cooldown > 0 || isLoading
                      ? 'text-slate-400 dark:text-slate-600 cursor-not-allowed'
                      : 'text-indigo-600 dark:text-indigo-400 hover:underline'
                  )}
                >
                  <RefreshCw className={cn("size-3", isLoading && "animate-spin")} />
                  {cooldown > 0 ? `Resend in ${cooldown}s` : 'Resend Code'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setErrorMsg(null);
                    setSuccessMsg(null);
                    setStep('email');
                  }}
                  className="text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 font-semibold"
                >
                  ← Change email
                </button>
              </div>

              {/* Submit OTP Verification */}
              <Button
                type="submit"
                disabled={isLoading}
                className="w-full font-semibold bg-indigo-600 hover:bg-indigo-700 text-white shadow-lg shadow-indigo-500/10 transition-colors mt-2"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 size-4 animate-spin" />
                    Verifying Code...
                  </>
                ) : (
                  'Verify Code'
                )}
              </Button>
            </form>
          )}

          {step === 'reset' && (
            <form onSubmit={handleResetPassword} className="space-y-4">
              {/* New Password */}
              <div className="space-y-1.5">
                <Label htmlFor="newPassword">New Password</Label>
                <div className="relative">
                  <Input
                    id="newPassword"
                    type={showPassword ? 'text' : 'password'}
                    placeholder="••••••••"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    required
                    className="pl-10 pr-10 border-slate-200 dark:border-slate-800 focus-visible:ring-indigo-500"
                  />
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 size-4" />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
                  >
                    {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                  </button>
                </div>
              </div>

              {/* Confirm Password */}
              <div className="space-y-1.5">
                <Label htmlFor="confirmPassword">Confirm Password</Label>
                <div className="relative">
                  <Input
                    id="confirmPassword"
                    type={showConfirmPassword ? 'text' : 'password'}
                    placeholder="••••••••"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                    className="pl-10 pr-10 border-slate-200 dark:border-slate-800 focus-visible:ring-indigo-500"
                  />
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 size-4" />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
                  >
                    {showConfirmPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                  </button>
                </div>
              </div>

              {/* Submit Reset */}
              <Button
                type="submit"
                disabled={isLoading}
                className="w-full font-semibold bg-indigo-600 hover:bg-indigo-700 text-white shadow-lg shadow-indigo-500/10 transition-colors mt-2"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 size-4 animate-spin" />
                    Resetting password...
                  </>
                ) : (
                  'Reset Password'
                )}
              </Button>
            </form>
          )}

          {/* Success / Error Alerts */}
          {errorMsg && (
            <Alert variant="destructive" className="mt-4">
              <AlertCircle className="size-4" />
              <AlertTitle>Error</AlertTitle>
              <AlertDescription className="text-xs">{errorMsg}</AlertDescription>
            </Alert>
          )}

          {successMsg && (
            <Alert className="mt-4 border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
              <CheckCircle2 className="size-4 text-emerald-500" />
              <AlertTitle>Success</AlertTitle>
              <AlertDescription className="text-xs">{successMsg}</AlertDescription>
            </Alert>
          )}

          {/* Return to Login */}
          <div className="text-center text-sm text-slate-500 dark:text-slate-400 mt-6 pt-4 border-t border-slate-100 dark:border-slate-800/80">
            <Link
              href="/login"
              className="inline-flex items-center gap-1 font-semibold text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 transition-colors"
            >
              <ArrowLeft className="size-4" />
              Back to Sign In
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
