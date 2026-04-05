export interface AppInfo {
  name: string;
  developer: string;
  icon: string;
  rating: number;
  category: string;
  url: string;
  description: string;
}

export async function getTrendingApps(platform: string = "ios", limit: number = 25): Promise<AppInfo[]> {
  try {
    // Apple RSS Feed — official JSON API, no scraping needed
    const feedUrl = `https://rss.applemarketingtools.com/api/v2/tr/apps/top-free/${limit}/apps.json`;
    const res = await fetch(feedUrl, { signal: AbortSignal.timeout(10000) });
    if (!res.ok) return [];
    const data = await res.json();
    return (data.feed?.results || []).map((app: any) => ({
      name: app.name || "",
      developer: app.artistName || "",
      icon: app.artworkUrl100 || "",
      rating: 0, // RSS feed doesn't include ratings
      category: app.genres?.[0]?.name || "",
      url: app.url || "",
      description: "", // RSS feed has limited data
    }));
  } catch (err) {
    return [];
  }
}
