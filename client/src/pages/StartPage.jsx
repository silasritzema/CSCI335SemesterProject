export default function StartPage() {
    return (
        <div className="flex min-h-screen items-center justify-center bg-[#141414] px-6 text-[#d7d7d7]">
            <div className="w-full max-w-lg rounded-2xl border border-[#303030] bg-[#1a1a1a] p-8 shadow-2xl">
                <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#8d8d8d]">
                    Start Page
                </p>
                <h1 className="mt-2 text-2xl font-semibold text-[#f2f2f2]">
                    Studio launch page is not wired yet.
                </h1>
                <p className="mt-3 text-sm leading-6 text-[#a9a9a9]">
                    This placeholder keeps the route lint-safe until auth or onboarding is implemented.
                    The active application entry point still goes straight to the studio.
                </p>
            </div>
        </div>
    );
}
