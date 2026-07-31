// Remove caches created by older service workers that could return stale
// hashed chunks after a deployment. This runs once per browser session.
(() => {
  const resetKey = 'bwenge-service-worker-reset-v3';
  try {
    if (sessionStorage.getItem(resetKey)) return;
    sessionStorage.setItem(resetKey, '1');
  } catch {
    return;
  }

  if (!('serviceWorker' in navigator)) return;

  Promise.all([
    navigator.serviceWorker.getRegistrations().then((registrations) =>
      Promise.all(registrations.map((registration) => registration.unregister()))
    ),
    'caches' in window
      ? caches.keys().then((keys) => Promise.all(keys.map((key) => caches.delete(key))))
      : Promise.resolve(),
  ])
    .then(() => window.location.reload())
    .catch(() => undefined);
})();
