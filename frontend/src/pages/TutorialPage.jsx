import { useNavigate } from 'react-router-dom';
import DAWPage from './DAWPage';

// Benjamin Lee
// This page is currently just a placeholder, but it will eventually be the home page for the app. 
// Right now, it only has a basic tutorial, but later it will include an text
// or text-to-speech option.


function TutorialPage() {
    const navigate = useNavigate();

    function changePage() {
        navigate('/DAWpage');
    }

    return ( // Build page and return it
        <div className="min-h-screen bg-base-300 p-6">
            <h1 className="text-2xl font-bold mb-4">Tutorial</h1>
            
            {/* Controls */}
            <div className="flex gap-2 mb-6">
                <h1 className="text-xl font-semibold">Step 1. Select the chord you want to choose.</h1>
            </div>
            <div className2="flex gap-2 mb-6">
                <h2 className2="text-xl font-semibold">Step 2. Select the number of fingers.</h2>
            </div>
            <div className3="flex gap-2 mb-6">
                <h3 className3="text-xl font-semibold">Step 3. Click the add button.</h3>
            </div>

            <button tutorial="btn btn-primary" onClick={changePage} disabled={false}>Go to Chord Builder</button>
        </div>
        
    );
}

export default TutorialPage;