import { useNavigate } from 'react-router-dom';
import StartPage from './StartPage';

// Benjamin Lee
// This page is currently just a placeholder, but it will eventually be the home page for the app. 
// Right now, it only has a basic tutorial, but later it will include an text
// or text-to-speech option.


function TutorialPage() {
    const navigate = useNavigate();

    function changePage() {
        navigate('/StartPage');
    }

    return ( // Build page and return it
        <div className="min-h-screen bg-base-300 p-6">
            <h1 className="text-2xl font-bold mb-4">Start Page</h1>
            
            {/* Controls */}
            <div className="flex gap-2 mb-6">
                <h1 className="text-xl font-semibold">Welcome to the Chord Builder! Press the button below to get started.</h1>
            </div>
            <button tutorial="btn btn-primary" onClick={changePage} disabled={false}>Go To Chord Builder</button>
        </div>
        
    );
}

export default TutorialPage;