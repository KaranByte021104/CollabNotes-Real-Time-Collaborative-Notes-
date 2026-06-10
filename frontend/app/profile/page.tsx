"use client";

import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Loader2, Camera, Trash2, ShieldAlert } from 'lucide-react';
import { toast } from 'sonner';

import { useAuth } from '@/context/auth-context';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import api from '@/lib/axios';

const generateColorFromName = (name: string): string => {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  const colors = [
    'bg-red-500', 'bg-orange-500', 'bg-amber-500', 'bg-green-500',
    'bg-emerald-500', 'bg-teal-500', 'bg-cyan-500', 'bg-sky-500',
    'bg-blue-500', 'bg-indigo-500', 'bg-violet-500', 'bg-purple-500',
    'bg-fuchsia-500', 'bg-pink-500', 'bg-rose-500'
  ];
  return colors[Math.abs(hash) % colors.length];
};

export default function ProfilePage() {
  const { user, updateUser, isLoading } = useAuth();
  const router = useRouter();

  // Form states
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [bio, setBio] = useState('');
  const [nameError, setNameError] = useState<string | null>(null);
  const [emailError, setEmailError] = useState<string | null>(null);
  
  // Loading & uploading states
  const [isSaving, setIsSaving] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [avatarError, setAvatarError] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (user) {
      setName(user.name);
      setEmail(user.email);
      setBio(user.bio || '');
    }
  }, [user]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center">
        <Loader2 className="size-8 animate-spin text-indigo-600" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center p-4">
        <Card className="max-w-md w-full text-center p-6 space-y-4">
          <ShieldAlert className="size-12 text-amber-500 mx-auto" />
          <CardTitle>Unauthorized</CardTitle>
          <CardDescription>You must be signed in to view this page.</CardDescription>
          <Button onClick={() => router.push('/login')} className="w-full bg-indigo-650 hover:bg-indigo-755 text-white">
            Go to Login
          </Button>
        </Card>
      </div>
    );
  }

  const getBackendUrl = () => {
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';
    return apiUrl.replace(/\/api$/, '');
  };

  const hasChanges = name.trim() !== user.name || email.trim() !== user.email || bio !== (user.bio || '');
  const isValid = name.trim().length >= 2 && name.trim().length <= 60 && bio.length <= 160 && !nameError && email.trim() && !emailError;

  const handleNameChange = (val: string) => {
    setName(val);
    if (val.trim().length < 2) {
      setNameError('Name must be at least 2 characters.');
    } else if (val.trim().length > 60) {
      setNameError('Name must not exceed 60 characters.');
    } else {
      setNameError(null);
    }
  };

  const handleEmailChange = (val: string) => {
    setEmail(val);
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!val.trim()) {
      setEmailError('Email is required.');
    } else if (!emailRegex.test(val.trim())) {
      setEmailError('Please enter a valid email address.');
    } else {
      setEmailError(null);
    }
  };

  const handleAvatarUpload = async (file: File) => {
    const allowedMimeTypes = ['image/jpeg', 'image/png', 'image/webp'];
    if (!allowedMimeTypes.includes(file.type)) {
      setAvatarError('Only image files (JPEG, PNG, WebP) are allowed.');
      return;
    }
    const maxSizeBytes = 5 * 1024 * 1024;
    if (file.size > maxSizeBytes) {
      setAvatarError('File size must be under 5MB.');
      return;
    }

    setAvatarError(null);
    setIsUploading(true);
    const formData = new FormData();
    formData.append('avatar', file);

    try {
      const response = await api.post('/profile/avatar', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      updateUser(response.data);
      toast.success('Avatar updated');
    } catch (err: any) {
      console.error(err);
      const msg = err.response?.data?.message || 'Failed to upload avatar';
      setAvatarError(Array.isArray(msg) ? msg[0] : msg);
      toast.error('Failed to upload avatar');
    } finally {
      setIsUploading(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      handleAvatarUpload(e.target.files[0]);
    }
  };

  const handleRemoveAvatar = async () => {
    setIsUploading(true);
    setAvatarError(null);
    try {
      const response = await api.delete('/profile/avatar');
      updateUser(response.data);
      toast.success('Avatar removed');
    } catch (err: any) {
      console.error(err);
      toast.error('Failed to remove avatar');
    } finally {
      setIsUploading(false);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleAvatarUpload(e.dataTransfer.files[0]);
    }
  };

  const handleSubmitForm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isValid || !hasChanges) return;

    setIsSaving(true);
    try {
      const response = await api.patch('/profile', { name, email, bio });
      updateUser(response.data);
      toast.success('Profile updated');
    } catch (err: any) {
      console.error(err);
      const msg = err.response?.data?.message || 'Failed to update profile';
      toast.error(Array.isArray(msg) ? msg[0] : msg);
    } finally {
      setIsSaving(false);
    }
  };

  const userInitial = user.name.charAt(0).toUpperCase();
  const avatarBgColor = generateColorFromName(user.name);

  // Formatting date
  let memberSinceStr = 'Joined recently';
  if (user.createdAt) {
    try {
      memberSinceStr = `Member since ${new Date(user.createdAt).toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}`;
    } catch (e) {}
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col justify-center items-center px-4 py-12 relative overflow-hidden">
      {/* Decorative background blobs */}
      <div className="absolute top-0 -left-4 w-72 h-72 bg-indigo-500 rounded-full mix-blend-multiply filter blur-xl opacity-10 animate-blob" />
      <div className="absolute top-0 -right-4 w-72 h-72 bg-purple-500 rounded-full mix-blend-multiply filter blur-xl opacity-10 animate-blob animation-delay-2000" />

      <div className="w-full max-w-lg space-y-4 relative z-10">
        <button
          onClick={() => router.back()}
          className="flex items-center gap-2 text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-colors text-sm font-semibold mb-2 focus:outline-none"
        >
          <ArrowLeft className="size-4" />
          <span>Back</span>
        </button>

        <Card className="border-slate-200 dark:border-slate-800/80 bg-white/95 dark:bg-slate-900/95 shadow-2xl backdrop-blur-md">
          <CardHeader className="text-center pb-4">
            <CardTitle className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">Profile Details</CardTitle>
            <CardDescription className="text-slate-500 dark:text-slate-400">
              Manage your identity and bio details
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            
            {/* Large Avatar Circle & Upload Section */}
            <div className="flex flex-col items-center gap-3">
              <div 
                className={`size-24 rounded-full relative overflow-hidden border-2 flex items-center justify-center transition-all ${
                  isDragging ? 'border-indigo-500 bg-indigo-50/50 dark:bg-indigo-950/20 scale-105' : 'border-slate-200 dark:border-slate-800'
                }`}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
              >
                {isUploading ? (
                  <div className="absolute inset-0 bg-slate-950/40 backdrop-blur-xs flex items-center justify-center z-10">
                    <Loader2 className="size-6 animate-spin text-white" />
                  </div>
                ) : null}

                {user.avatarUrl ? (
                  <img
                    src={`${getBackendUrl()}${user.avatarUrl}`}
                    alt={user.name}
                    className="size-full object-cover"
                  />
                ) : (
                  <div className={`size-full ${avatarBgColor} text-white flex items-center justify-center text-3xl font-extrabold shadow-inner`}>
                    {userInitial}
                  </div>
                )}

                {/* Hover Camera Icon Overlay */}
                <div className="absolute inset-0 bg-black/40 opacity-0 hover:opacity-100 flex items-center justify-center text-white cursor-pointer transition-opacity" onClick={() => fileInputRef.current?.click()}>
                  <Camera className="size-6" />
                </div>
              </div>

              {/* Photo control buttons */}
              <div className="flex items-center gap-2">
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileChange}
                  accept="image/*"
                  className="hidden"
                />
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isUploading}
                  className="border-slate-200 dark:border-slate-800 text-xs font-semibold"
                >
                  Change Photo
                </Button>
                {user.avatarUrl && (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={handleRemoveAvatar}
                    disabled={isUploading}
                    className="text-red-500 hover:text-red-650 hover:bg-red-50 dark:hover:bg-red-950/20 text-xs font-semibold"
                  >
                    <Trash2 className="size-3.5 mr-1" />
                    Remove Photo
                  </Button>
                )}
              </div>

              {avatarError && (
                <p className="text-xs font-semibold text-red-500 text-center max-w-xs">{avatarError}</p>
              )}
            </div>

            {/* Profile fields form */}
            <form onSubmit={handleSubmitForm} className="space-y-4">
              
              {/* Display Name */}
              <div className="space-y-1.5">
                <Label htmlFor="name" className="text-sm font-bold text-slate-700 dark:text-slate-300">Display Name</Label>
                <Input
                  id="name"
                  type="text"
                  value={name}
                  onChange={(e) => handleNameChange(e.target.value)}
                  placeholder="Your Name"
                  className={`border-slate-200 dark:border-slate-800 focus-visible:ring-indigo-500 ${
                    nameError ? 'border-red-500 focus-visible:ring-red-500' : ''
                  }`}
                  required
                />
                {nameError && (
                  <p className="text-xs font-semibold text-red-500 mt-0.5">{nameError}</p>
                )}
              </div>

              {/* Email Address */}
              <div className="space-y-1.5">
                <Label htmlFor="email" className="text-sm font-bold text-slate-700 dark:text-slate-300">Email Address</Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => handleEmailChange(e.target.value)}
                  placeholder="Your Email"
                  className={`border-slate-200 dark:border-slate-800 focus-visible:ring-indigo-500 ${
                    emailError ? 'border-red-500 focus-visible:ring-red-500' : ''
                  }`}
                  required
                />
                {emailError && (
                  <p className="text-xs font-semibold text-red-500 mt-0.5">{emailError}</p>
                )}
              </div>

              {/* Bio */}
              <div className="space-y-1.5">
                <Label htmlFor="bio" className="text-sm font-bold text-slate-700 dark:text-slate-300">Bio</Label>
                <textarea
                  id="bio"
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  placeholder="Tell others a little about yourself..."
                  maxLength={160}
                  rows={3}
                  className="w-full rounded-lg border border-slate-200 dark:border-slate-800 bg-transparent px-2.5 py-1.5 text-base transition-colors outline-none placeholder:text-muted-foreground focus-visible:border-indigo-500 focus-visible:ring-3 focus-visible:ring-indigo-500/10 md:text-sm dark:bg-slate-900/30"
                />
                <div className="flex justify-between items-center mt-0.5">
                  <span className="text-[10px] text-slate-400 dark:text-slate-500">Max 160 characters</span>
                  <span className={`text-xs font-semibold ${
                    bio.length > 140 ? 'text-red-500 animate-pulse' : 'text-slate-400 dark:text-slate-500'
                  }`}>
                    {bio.length} / 160
                  </span>
                </div>
              </div>

              {/* Save changes button */}
              <Button
                type="submit"
                disabled={isSaving || !hasChanges || !isValid}
                className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-semibold shadow-lg shadow-indigo-500/10 h-10 mt-6"
              >
                {isSaving ? (
                  <>
                    <Loader2 className="mr-2 size-4 animate-spin" />
                    Saving changes...
                  </>
                ) : (
                  'Save Changes'
                )}
              </Button>
            </form>
          </CardContent>
          <CardFooter className="flex justify-center border-t border-slate-100 dark:border-slate-800/80 py-4 bg-slate-50/50 dark:bg-slate-950/20 rounded-b-2xl">
            <span className="text-xs text-slate-400 dark:text-slate-500 font-semibold">{memberSinceStr}</span>
          </CardFooter>
        </Card>
      </div>
    </div>
  );
}
