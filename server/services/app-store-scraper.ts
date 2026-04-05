export interface AppInfo {
  name: string;
  developer: string;
  icon: string;
  rating: number;
  category: string;
  url: string;
  description: string;
  screenshots?: string[];
  version?: string;
  price?: string;
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

export async function getAppDetails(appId: string, country: string = "tr"): Promise<AppInfo | null> {
  try {
    const res = await fetch(`https://itunes.apple.com/lookup?id=${appId}&country=${country}`, {
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) return null;
    const data = await res.json() as any;
    const app = data.results?.[0];
    if (!app) return null;
    return {
      name: app.trackName || "",
      developer: app.artistName || "",
      icon: app.artworkUrl100 || "",
      rating: app.averageUserRating || 0,
      category: app.primaryGenreName || "",
      url: app.trackViewUrl || "",
      description: app.description || "",
      screenshots: app.screenshotUrls || [],
      version: app.version || "",
      price: app.formattedPrice || "Free",
    };
  } catch {
    return null;
  }
}
