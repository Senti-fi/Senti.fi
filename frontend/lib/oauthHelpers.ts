// lib/oauthHelpers.ts
export async function getGoogleIdToken(clientId: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const win = window as any;
    if (!win.google) {
      // load Google Identity Services script
      const s = document.createElement('script');
      s.src = 'https://accounts.google.com/gsi/client';
      s.async = true;
      s.onload = () => {
        init();
      };
      s.onerror = reject;
      document.head.appendChild(s);
    } else {
      init();
    }

    function init() {
      try {
        win.google.accounts.id.initialize({
          client_id: clientId,
          callback: (resp: any) => {
            // resp.credential is the id_token
            if (resp?.credential) resolve(resp.credential);
            else reject(new Error('No credential returned'));
          },
        });
        // show the popup-style prompt by rendering a temporary button UI
        // We can also use `prompt()` but rendering the button is easy and reliable:
        const container = document.createElement('div');
        container.style.position = 'fixed';
        container.style.left = '-9999px';
        document.body.appendChild(container);
        win.google.accounts.id.renderButton(container, { theme: 'outline', size: 'large' });
        // programmatically click the button to open the flow
        const btn = container.querySelector('div');
        if (btn) (btn as HTMLElement).click();
        // cleanup after 2 seconds in case it didn't open
        setTimeout(() => container.remove(), 3000);
      } catch (err) {
        console.log('Google ID token error', err);
        reject(err);
      }
    }
  });
}

/**
 * Apple Sign In: this requires that you register your web domain with Apple,
 * configure the Service ID, and include Apple's JS:
 *   <script src="https://appleid.cdn-apple.com/appleauth/static/jsapi/appleid/1/en_US/appleid.auth.js"></script>
 * Then you can call `AppleID.auth.signIn()` which returns a Promise that resolves to an object
 * containing an `authorization.id_token`. The code below attempts to call that flow.
 *
 * NOTE: Apple web sign-in is more involved (redirects and domain configuration).
 * Treat this helper as a starting point.
 */
export async function getAppleIdToken(clientId: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const win = window as any;
    // Ensure Apple script loaded
    if (!win.AppleID) {
      const s = document.createElement('script');
      s.src = 'https://appleid.cdn-apple.com/appleauth/static/jsapi/appleid/1/en_US/appleid.auth.js';
      s.onload = () => start();
      s.onerror = () => reject(new Error('Failed to load Apple script'));
      document.head.appendChild(s);
    } else start();

    function start() {
      try {
        // initialize (make sure clientId matches the Service ID configured in Apple)
        win.AppleID.auth.init({
          clientId,
          scope: 'name email',
          redirectURI: window.location.origin + '/singup', // can be same page for popup-less flow
          usePopup: true,
        });
        win.AppleID.auth.signIn().then((response: any) => {
          // response.authorization.id_token
          if (response?.authorization?.id_token) resolve(response.authorization.id_token);
          else reject(new Error('No id_token from Apple'));
        }).catch(reject);
      } catch (err) {
        reject(err);
      }
    }
  });
}
