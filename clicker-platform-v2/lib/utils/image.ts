
export function isSignedUrl(url: string | undefined | null): boolean {
    if (!url) return false;
    // Nuclear Option: Bypass Next.js optimization for ALL storage URLs
    // This shifts the fetching responsibility to the User's Browser (Client Client), 
    // effectively bypassing any Server-Side (Cloud Function) network/permission restrictions.
    return url.includes('?') ||
        url.includes('GoogleAccessId') ||
        url.includes('Signature') ||
        url.includes('storage.googleapis.com') ||
        url.includes('firebasestorage.googleapis.com');
}
