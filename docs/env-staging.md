// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyCCZHsPFgEuTJp4axMb3eh7GZP4TQe1rVo",
  authDomain: "clicker-universe.firebaseapp.com",
  projectId: "clicker-universe",
  storageBucket: "clicker-universe.firebasestorage.app",
  messagingSenderId: "1065982109250",
  appId: "1:1065982109250:web:38065ef041ac0ca5686fdb"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
{
  "hosting": {
    "site": "clickerapps",

    "public": "public",
    ...
  }
}

auth-gateway
// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyCCZHsPFgEuTJp4axMb3eh7GZP4TQe1rVo",
  authDomain: "clicker-universe.firebaseapp.com",
  projectId: "clicker-universe",
  storageBucket: "clicker-universe.firebasestorage.app",
  messagingSenderId: "1065982109250",
  appId: "1:1065982109250:web:8dc7772ab387d5ed686fdb"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
{
  "hosting": {
    "site": "clicker-auth-gateway",

    "public": "public",
    ...
  }
}

clicker-backyard
// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyCCZHsPFgEuTJp4axMb3eh7GZP4TQe1rVo",
  authDomain: "clicker-universe.firebaseapp.com",
  projectId: "clicker-universe",
  storageBucket: "clicker-universe.firebasestorage.app",
  messagingSenderId: "1065982109250",
  appId: "1:1065982109250:web:1d722db814340a4c686fdb"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
{
  "hosting": {
    "site": "clicker-backyard-app",

    "public": "public",
    ...
  }
}
## Staging Environment (`dev` branch)
To connect to the Staging Firebase project (`clicker-universe-stagging`) locally, create a `.env.local` file in each module (`auth-gateway`, `backyard`, `clicker-platform-v2`) with the following content:

```env
NEXT_PUBLIC_FIREBASE_API_KEY="AIzaSyDk_b_wMPuniEWxYebMB4aLfPb5kBDtLSA"
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN="clicker-universe-stagging.firebaseapp.com"
NEXT_PUBLIC_FIREBASE_PROJECT_ID="clicker-universe-stagging"
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET="clicker-universe-stagging.firebasestorage.app"
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID="603624012885"
NEXT_PUBLIC_FIREBASE_APP_ID="1:603624012885:web:2098c7fd9b1f06f440e8dc"
```
