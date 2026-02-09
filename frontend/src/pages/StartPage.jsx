import { useNavigate } from 'react-router-dom';
import DAWPage from './DAWPage';

// Silas Ritzema
// This page is currently just a placeholder, but it will eventually be the home page for the app. 
// It will have some information about the app and a button to go to the text-to-speech prompt, but
// until that page is built, it just has a button to go to the DAW page.


function StartPage() {
    const navigate = useNavigate();

    function changePage() {
        navigate('/DAWpage');
    }

    return ( // Build page and return it
        <div className="min-h-screen bg-base-300 p-6">
            <h1 className="text-2xl font-bold mb-4">Start Page</h1>
            
            {/* Controls */}
            <div className="flex gap-2 mb-6">
                <h1 className="text-xl font-semibold">Welcome to the Chord Builder! Press the button below to get started.</h1>
            </div>
            <button className="btn btn-primary" onClick={changePage} disabled={false}>Go To Chord Builder</button>
        </div>
        
    );
}

export default StartPage;