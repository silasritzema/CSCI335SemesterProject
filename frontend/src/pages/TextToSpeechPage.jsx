import { useNavigate } from 'react-router-dom';
import TutorialPage from './TutorialPage';
import {useState } from 'react';

// Christian Rast
// this page is a placeholder for a text to speech button that will be added to the start page


function TextToSpeechPage() {
    const navigate = useNavigate();

    function changePage() {
        navigate('/TutorialPage');
    }

    
    const [isEnabled, setIsEnabled] = useState(false);

      return (
        <div className="min-h-screen bg-base-300 p-6">
            <h1 className="text-2xl font-bold mb-4">Text to Speech Page</h1>
            
            {/* Controls */}
            <div className="flex gap-2 mb-6 items-center">
                <h1 className="text-xl font-semibold">Click to enable text to speech</h1>
                <input 
                    type="checkbox" 
                    className="toggle toggle-primary"
                    checked={isEnabled}
                    onChange={(e) => setIsEnabled(e.target.checked)}
                />
            </div>
            <button className="btn btn-primary" onClick={changePage} disabled={!isEnabled}>Go To Tutorial</button>
        </div>
    );


}

export default TextToSpeechPage;