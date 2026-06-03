import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { FileText, Sparkles, Users, Zap, ArrowRight, Github } from "lucide-react";

export default function Home() {
  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-slate-50 dark:bg-slate-950 px-4 sm:px-6 lg:px-8">
      {/* Background Decorative Gradients */}
      <div className="absolute top-0 -left-4 w-72 h-72 bg-indigo-500 rounded-full mix-blend-multiply filter blur-xl opacity-20 animate-blob" />
      <div className="absolute top-0 -right-4 w-72 h-72 bg-purple-500 rounded-full mix-blend-multiply filter blur-xl opacity-20 animate-blob animation-delay-2000" />
      <div className="absolute -bottom-8 left-20 w-72 h-72 bg-pink-500 rounded-full mix-blend-multiply filter blur-xl opacity-20 animate-blob animation-delay-4000" />

      {/* Main Content Container */}
      <div className="relative z-10 w-full max-w-4xl text-center space-y-12">
        
        {/* Header Hero Section */}
        <div className="space-y-6">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-50 dark:bg-indigo-950/50 border border-indigo-100 dark:border-indigo-900/50 text-indigo-600 dark:text-indigo-400 text-sm font-medium animate-fade-in">
            <Sparkles className="size-4" />
            <span>Now in Beta</span>
          </div>

          <h1 className="text-5xl sm:text-6xl font-extrabold tracking-tight text-slate-900 dark:text-white">
            Meet <span className="bg-clip-text text-transparent bg-gradient-to-r from-indigo-600 to-purple-600 dark:from-indigo-400 dark:to-purple-400">CollabNotes</span>
          </h1>

          <p className="max-w-xl mx-auto text-lg sm:text-xl text-slate-600 dark:text-slate-400 font-medium">
            Real-time collaborative notes for your team. Seamlessly capture ideas, organize documents, and sync with your peers instantly.
          </p>
        </div>

        {/* Action Buttons with Shadcn */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
          <Button 
            id="btn-get-started"
            size="lg" 
            className="w-full sm:w-auto font-semibold bg-indigo-600 hover:bg-indigo-700 text-white shadow-lg shadow-indigo-500/20 transition-all hover:scale-[1.02] active:scale-[0.98]"
          >
            Get Started Free
            <ArrowRight className="ml-2 size-4" />
          </Button>
          
          <Button 
            id="btn-view-docs"
            variant="outline" 
            size="lg" 
            className="w-full sm:w-auto font-semibold border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-900 transition-all"
          >
            Documentation
          </Button>
        </div>

        {/* Features / Preview Mock Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-8 text-left">
          
          <Card className="border-slate-200 dark:border-slate-800/80 bg-white/70 dark:bg-slate-900/50 backdrop-blur-md hover:shadow-xl transition-all duration-300">
            <CardHeader>
              <div className="size-10 rounded-lg bg-indigo-50 dark:bg-indigo-950/40 flex items-center justify-center text-indigo-600 dark:text-indigo-400 mb-2">
                <Zap className="size-5" />
              </div>
              <CardTitle className="text-lg">Real-Time Sync</CardTitle>
              <CardDescription>
                Changes persist instantly. Multiple users can write, edit, and comment together without conflict.
              </CardDescription>
            </CardHeader>
          </Card>

          <Card className="border-slate-200 dark:border-slate-800/80 bg-white/70 dark:bg-slate-900/50 backdrop-blur-md hover:shadow-xl transition-all duration-300">
            <CardHeader>
              <div className="size-10 rounded-lg bg-purple-50 dark:bg-purple-950/40 flex items-center justify-center text-purple-600 dark:text-purple-400 mb-2">
                <Users className="size-5" />
              </div>
              <CardTitle className="text-lg">Team Workspaces</CardTitle>
              <CardDescription>
                Set up private collections, share specific workspaces, and invite collaborators in just one click.
              </CardDescription>
            </CardHeader>
          </Card>

          <Card className="border-slate-200 dark:border-slate-800/80 bg-white/70 dark:bg-slate-900/50 backdrop-blur-md hover:shadow-xl transition-all duration-300">
            <CardHeader>
              <div className="size-10 rounded-lg bg-pink-50 dark:bg-pink-950/40 flex items-center justify-center text-pink-600 dark:text-pink-400 mb-2">
                <FileText className="size-5" />
              </div>
              <CardTitle className="text-lg">Markdown Rich Editing</CardTitle>
              <CardDescription>
                Write comfortably in standard markdown, insert code blocks, tables, lists, and watch it render beautifully.
              </CardDescription>
            </CardHeader>
          </Card>

        </div>

        {/* Footer */}
        <div className="pt-12 text-slate-400 dark:text-slate-600 text-sm flex flex-col sm:flex-row items-center justify-between border-t border-slate-200/50 dark:border-slate-800/50">
          <p>© {new Date().getFullYear()} CollabNotes. All rights reserved.</p>
          <a 
            href="#" 
            className="flex items-center gap-2 hover:text-slate-600 dark:hover:text-slate-400 transition-colors mt-2 sm:mt-0"
          >
            <Github className="size-4" />
            <span>GitHub Repository</span>
          </a>
        </div>

      </div>
    </div>
  );
}
