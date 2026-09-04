import { useEffect } from 'react';
import { supabase } from '../services/supabaseClient';
import { useAuth } from './useAuth';

declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (config: {
            client_id: string;
            callback: (response: { credential: string }) => void;
            auto_select?: boolean;
            cancel_on_tap_outside?: boolean;
          }) => void;
          prompt: (notificationCallback?: (notification: unknown) => void) => void;
        };
      };
    };
  }
}

export function useGoogleOneTap() {
  const { user } = useAuth();
  const googleClientId = (import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined) || '503299800983-2pfb0k2puce4negl38jdef4l4psdal99.apps.googleusercontent.com';

  useEffect(() => {
    if (!googleClientId || user || !supabase) return;

    const scriptId = 'google-gsi-client';
    if (!document.getElementById(scriptId)) {
      const script = document.createElement('script');
      script.id = scriptId;
      script.src = 'https://accounts.google.com/gsi/client';
      script.async = true;
      script.defer = true;
      script.onload = () => initOneTap();
      document.head.appendChild(script);
    } else {
      initOneTap();
    }

    function initOneTap() {
      if (!window.google?.accounts?.id || !googleClientId) return;

      try {
        window.google.accounts.id.initialize({
          client_id: googleClientId,
          callback: async (response: { credential: string }) => {
            if (!response.credential || !supabase) return;
            try {
              await supabase.auth.signInWithIdToken({
                provider: 'google',
                token: response.credential,
              });
            } catch (err) {
              console.error('Google One Tap sign in error:', err);
            }
          },
          auto_select: false,
          cancel_on_tap_outside: true,
        });

        window.google.accounts.id.prompt();
      } catch (err) {
        console.warn('Failed to prompt Google One Tap:', err);
      }
    }
  }, [googleClientId, user]);
}
