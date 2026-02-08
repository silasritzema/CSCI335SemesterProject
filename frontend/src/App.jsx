import { BrowserRouter, Routes, Route } from 'react-router-dom';
import DAWPage from './pages/DAWPage';
import './App.css';

function App() {

  /**
   * Home page is currently set to DAW page, this needs to be updated as soon as a real home page is created.
   * If you guys want to change theme feel free to do so. You can look for new ones at
   * https://daisyui.com/docs/themes/ and then replace what I have written in ./index.css and ./index.html 
   */

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<DAWPage />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
