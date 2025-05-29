import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { Provider } from 'react-redux';
import { store } from './store';

// Lazy load components
const Home = React.lazy(() => import('./pages/Home'));
const Profile = React.lazy(() => import('./pages/Profile'));
const Post = React.lazy(() => import('./pages/Post'));

function App(): JSX.Element {
  return (
    <Provider store={store}>
      <Router>
        <React.Suspense fallback={<div>Loading...</div>}>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/profile/:id" element={<Profile />} />
            <Route path="/post/:id" element={<Post />} />
          </Routes>
        </React.Suspense>
      </Router>
    </Provider>
  );
}

export default App;
