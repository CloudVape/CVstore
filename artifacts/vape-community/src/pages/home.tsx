import { useGetTrendingPosts, useGetLatestPosts, useGetCommunityStats, useGetActiveUsers } from "@workspace/api-client-react";
import { Link } from "wouter";
import { PostCard } from "@/components/post-card";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, MessageSquare, Activity, Zap, Flame, ArrowRight } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

export default function Home() {
  const { data: stats } = useGetCommunityStats();
  const { data: trending } = useGetTrendingPosts();
  const { data: latest } = useGetLatestPosts();
  const { data: activeUsers } = useGetActiveUsers();

  return (
    <div className="flex flex-col w-full min-h-screen bg-background">
      {/* Hero Section */}
      <section className="relative w-full overflow-hidden border-b border-border/40">
        <div className="absolute inset-0 bg-background/80 z-10" />
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/50 to-transparent z-10" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(var(--primary),0.15),transparent_50%)] z-10" />
        
        <img 
          src="/images/hero-banner.jpg" 
          alt="Vape Community Hero" 
          className="absolute inset-0 w-full h-full object-cover object-center opacity-40 mix-blend-screen"
        />
        
        <div className="container relative z-20 mx-auto max-w-6xl px-4 py-24 sm:py-32 md:py-40 flex flex-col items-center text-center">
          <div className="inline-flex items-center rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-sm text-primary mb-6 font-mono backdrop-blur-md">
            <span className="flex h-2 w-2 rounded-full bg-primary mr-2 animate-pulse" />
            VapeCommunity is Live
          </div>
          <h1 className="text-4xl sm:text-6xl md:text-7xl font-black tracking-tighter text-foreground mb-6 uppercase max-w-4xl drop-shadow-[0_0_30px_rgba(0,0,0,0.8)]">
            The Internet's <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary to-secondary">Home Base</span> for Vapers
          </h1>
          <p className="text-lg sm:text-xl text-muted-foreground max-w-2xl mb-10 font-medium leading-relaxed drop-shadow-[0_2px_10px_rgba(0,0,0,0.8)]">
            Join the conversation. Share your builds, review gear, and connect with a thriving community of cloud chasers and flavor enthusiasts.
          </p>
          <div className="flex flex-wrap gap-4 justify-center">
            <Link href="/forum">
              <Button size="lg" className="h-12 px-8 rounded-full bg-primary hover:bg-primary/90 text-primary-foreground font-mono text-sm uppercase tracking-wider shadow-[0_0_20px_rgba(var(--primary),0.4)] transition-all hover:shadow-[0_0_30px_rgba(var(--primary),0.6)]">
                Enter Forum
              </Button>
            </Link>
            <Link href="/join">
              <Button size="lg" variant="outline" className="h-12 px-8 rounded-full border-border/50 bg-background/50 backdrop-blur-sm hover:bg-background/80 font-mono text-sm uppercase tracking-wider">
                Join Community
              </Button>
            </Link>
          </div>
        </div>
      </section>

      <div className="container mx-auto max-w-6xl px-4 py-12 flex flex-col lg:flex-row gap-8">
        
        <div className="flex-1 space-y-12">
          {/* Trending Section */}
          <section className="space-y-6">
            <div className="flex items-center justify-between border-b border-border/40 pb-4">
              <h2 className="text-2xl font-black uppercase tracking-tight flex items-center gap-2">
                <Flame className="h-6 w-6 text-primary" />
                Trending Now
              </h2>
              <Link href="/forum">
                <Button variant="ghost" size="sm" className="font-mono text-xs hidden sm:flex">View all <ArrowRight className="ml-2 h-4 w-4" /></Button>
              </Link>
            </div>
            
            <div className="grid gap-4 sm:grid-cols-2">
              {trending?.slice(0, 4).map(post => (
                <PostCard key={post.id} post={post} compact />
              ))}
              {!trending?.length && (
                <div className="col-span-2 py-12 text-center text-muted-foreground font-mono border border-dashed border-border/40 rounded-xl">
                  Loading trending clouds...
                </div>
              )}
            </div>
          </section>

          {/* Latest Section */}
          <section className="space-y-6">
            <div className="flex items-center justify-between border-b border-border/40 pb-4">
              <h2 className="text-2xl font-black uppercase tracking-tight flex items-center gap-2">
                <Zap className="h-6 w-6 text-secondary" />
                Latest Drops
              </h2>
            </div>
            
            <div className="grid gap-4">
              {latest?.slice(0, 5).map(post => (
                <PostCard key={post.id} post={post} />
              ))}
              {!latest?.length && (
                <div className="py-12 text-center text-muted-foreground font-mono border border-dashed border-border/40 rounded-xl">
                  Loading latest posts...
                </div>
              )}
            </div>
          </section>
        </div>

        {/* Sidebar */}
        <div className="w-full lg:w-80 space-y-6 flex-shrink-0">
          {/* Stats Card */}
          <Card className="border-border/40 bg-card/40 backdrop-blur">
            <CardHeader className="pb-4">
              <CardTitle className="font-mono text-sm uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                <Activity className="h-4 w-4 text-primary" />
                Community Pulse
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {stats ? (
                <>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <p className="text-2xl font-black tracking-tighter text-primary">{stats.totalUsers.toLocaleString()}</p>
                      <p className="text-xs text-muted-foreground font-mono uppercase">Vapers</p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-2xl font-black tracking-tighter text-secondary">{stats.onlineNow.toLocaleString()}</p>
                      <p className="text-xs text-muted-foreground font-mono uppercase flex items-center gap-1">
                        <span className="h-1.5 w-1.5 rounded-full bg-secondary animate-pulse" /> Online
                      </p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-2xl font-black tracking-tighter text-foreground">{stats.totalPosts.toLocaleString()}</p>
                      <p className="text-xs text-muted-foreground font-mono uppercase">Posts</p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-2xl font-black tracking-tighter text-foreground">{stats.postsToday.toLocaleString()}</p>
                      <p className="text-xs text-muted-foreground font-mono uppercase">Today</p>
                    </div>
                  </div>
                  <div className="pt-4 border-t border-border/40">
                    <p className="text-xs text-muted-foreground font-mono uppercase mb-2">Top Category</p>
                    <p className="text-sm font-semibold">{stats.topCategory || "Loading..."}</p>
                  </div>
                </>
              ) : (
                <div className="py-8 text-center text-sm font-mono text-muted-foreground">Gathering stats...</div>
              )}
            </CardContent>
          </Card>

          {/* Active Users */}
          <Card className="border-border/40 bg-card/40 backdrop-blur">
            <CardHeader className="pb-4">
              <CardTitle className="font-mono text-sm uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                <Users className="h-4 w-4" />
                Active Now
              </CardTitle>
            </CardHeader>
            <CardContent>
              {activeUsers && activeUsers.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {activeUsers.slice(0, 15).map(user => (
                    <Link key={user.id} href={`/profile/${user.id}`}>
                      <Avatar className="h-8 w-8 border border-border/50 hover:border-primary transition-colors cursor-pointer" title={user.username}>
                        <AvatarImage src={user.avatarUrl || undefined} />
                        <AvatarFallback className="text-[10px] bg-secondary/10 text-secondary">{user.username.substring(0, 2).toUpperCase()}</AvatarFallback>
                      </Avatar>
                    </Link>
                  ))}
                  {activeUsers.length > 15 && (
                    <div className="h-8 w-8 rounded-full border border-border/50 bg-muted flex items-center justify-center text-[10px] font-mono text-muted-foreground">
                      +{activeUsers.length - 15}
                    </div>
                  )}
                </div>
              ) : (
                <div className="py-4 text-center text-sm font-mono text-muted-foreground">No active users</div>
              )}
            </CardContent>
          </Card>
          
          <Card className="border-primary/20 bg-primary/5">
            <CardContent className="p-6 text-center space-y-4">
              <MessageSquare className="h-8 w-8 text-primary mx-auto opacity-80" />
              <h3 className="font-bold uppercase tracking-tight">Got gear to share?</h3>
              <p className="text-sm text-muted-foreground font-mono">Join to post your setup, reviews, or questions.</p>
              <Link href="/join" className="block w-full">
                <Button className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-mono text-xs uppercase tracking-wider rounded-full">
                  Create Account
                </Button>
              </Link>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}