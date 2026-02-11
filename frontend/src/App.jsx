import { BrowserRouter, Routes, Route } from 'react-router-dom';
import StartPage from './pages/StartPage';
import DAWPage from './pages/DAWPage';
import TutorialPage from './pages/TutorialPage';
import TextToSpeechPage from './pages/TextToSpeechPage';
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
        <Route path="/" element={<StartPage />} />
        <Route path="/DAWpage" element={<DAWPage />} />
        <Route path="/Tutorialpage" element={<TutorialPage />} />
        <Route path="/TextToSpeechPage" element={<TextToSpeechPage />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
