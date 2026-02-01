// auth/auth.js
(function () {
  // ✅ Firebase config (your values)
  var firebaseConfig = {
    apiKey: "AIzaSyCfvGI-PnFdkpCqB6zG5R7ZSv0pUicNNyg",
    authDomain: "news-app-sign-in.firebaseapp.com",
    projectId: "news-app-sign-in",
    storageBucket: "news-app-sign-in.firebasestorage.app",
    messagingSenderId: "1088200901644",
    appId: "1:1088200901644:web:317f8b8c52429256739a29",
    measurementId: "G-RT8LPH8Q5F"
  };

  // ✅ Support GitHub Pages project path like your index.html does
  function basePath() {
    var p = window.location.pathname || "";
    return (p.indexOf("/viralnewsalertwebsite/") !== -1) ? "/viralnewsalertwebsite" : "";
  }

  function ensureFirebase() {
    if (!window.firebase || !window.firebase.initializeApp) {
      throw new Error(
        "Firebase SDK not loaded. Make sure firebase-app-compat.js and firebase-auth-compat.js are included before auth.js"
      );
    }
  }

  ensureFirebase();

  // ✅ Initialize Firebase once
  try {
    if (!firebase.apps || !firebase.apps.length) {
      firebase.initializeApp(firebaseConfig);
    }
  } catch (e) {
    // ignore "already exists" edge cases
  }

  var auth = firebase.auth();

  // Compatibility stubs (your old code used these)
  function getAccessToken() { return ""; }
  function getRefreshToken() { return ""; }
  function clearTokens() { return true; }

  async function signup(email, password, name) {
    email = (email || "").trim();
    password = (password || "").trim();
    name = (name || "").trim();

    if (!email || !password) throw new Error("Please enter email and password.");
    if (!name) throw new Error("Please enter your name.");

    var cred = await auth.createUserWithEmailAndPassword(email, password);

    try {
      if (cred && cred.user && name) {
        await cred.user.updateProfile({ displayName: name });
      }
    } catch (e) {}

    return { email: cred.user ? cred.user.email : email };
  }

  async function login(email, password) {
    email = (email || "").trim();
    password = (password || "").trim();

    if (!email || !password) throw new Error("Please enter email and password.");

    var cred = await auth.signInWithEmailAndPassword(email, password);
    return { email: cred.user ? cred.user.email : email };
  }

  async function me() {
    var user = auth.currentUser;
    if (user && user.email) return { email: user.email };

    // wait briefly (Auth might still be restoring session)
    return await new Promise(function (resolve) {
      var done = false;
      var t = setTimeout(function () {
        if (done) return;
        done = true;
        resolve(null);
      }, 1200);

      auth.onAuthStateChanged(function (u) {
        if (done) return;
        done = true;
        clearTimeout(t);
        resolve(u && u.email ? { email: u.email } : null);
      });
    });
  }

  async function logout() {
    await auth.signOut();
    return true;
  }

  async function google() {
    var provider = new firebase.auth.GoogleAuthProvider();

    // Popup first (best for desktop)
    try {
      var result = await auth.signInWithPopup(provider);
      return { email: result && result.user ? result.user.email : "" };
    } catch (err) {
      // Fallback to redirect (better for mobile / blocked popups)
      try {
        sessionStorage.setItem("vn_google_redirect", "1");
      } catch (e) {}
      await auth.signInWithRedirect(provider);
      return null; // redirect will happen
    }
  }

  async function handleRedirectResult() {
    // Only try if we previously started a redirect
    var flag = "";
    try { flag = sessionStorage.getItem("vn_google_redirect") || ""; } catch (e) {}

    if (!flag) return null;

    try {
      var res = await auth.getRedirectResult();
      try { sessionStorage.removeItem("vn_google_redirect"); } catch (e) {}

      if (res && res.user && res.user.email) {
        return { email: res.user.email };
      }
      return null;
    } catch (e) {
      try { sessionStorage.removeItem("vn_google_redirect"); } catch (x) {}
      throw e;
    }
  }

  // Expose globally (same name your pages already use)
  window.VNAuth = {
    basePath: basePath,
    signup: signup,
    login: login,
    me: me,
    logout: logout,

    // Google auth helpers
    google: google,
    handleRedirectResult: handleRedirectResult,

    // compatibility with your old shape
    API_BASE: "",
    refreshAccessToken: async function(){ return false; },
    getAccessToken: getAccessToken,
    getRefreshToken: getRefreshToken,
    clearTokens: clearTokens
  };
})();
