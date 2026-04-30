import { TUTORIAL_SECTIONS } from '../tutorialContent';

export default function TutorialModal({ open, onClose }) {
    if (!open) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/65 px-4" onClick={onClose}>
            <div
                className="max-h-[85vh] w-full max-w-2xl overflow-y-auto rounded-xl border border-[#4a4a4a] bg-[#181818] p-5 text-[#dddddd] shadow-2xl"
                onClick={(e) => e.stopPropagation()}
                role="dialog"
                aria-modal="true"
                aria-labelledby="tutorial-modal-title"
            >
                <div className="mb-4 flex items-start justify-between gap-4 border-b border-[#343434] pb-3">
                    <div>
                        <h2 id="tutorial-modal-title" className="text-lg font-bold uppercase tracking-[0.14em] text-[#f2f2f2]">
                            Tutorial
                        </h2>
                        <p className="mt-1 text-sm text-[#9f9f9f]">
                            Quick guide for gesture mapping and the main studio workflow.
                        </p>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        className="btn btn-sm h-8 min-h-8 rounded border border-[#5a5a5a] bg-[#252525] px-3 text-[11px] font-semibold uppercase tracking-[0.08em] text-[#d7d7d7] hover:bg-[#313131]"
                    >
                        Close
                    </button>
                </div>

                <div className="space-y-4">
                    {TUTORIAL_SECTIONS.map((section) => (
                        <section key={section.title} className="rounded-lg border border-[#313131] bg-[#111111] p-4">
                            <h3 className="mb-2 text-sm font-semibold uppercase tracking-[0.1em] text-[#f3f3f3]">
                                {section.title}
                            </h3>
                            <ul className="space-y-2 text-sm leading-6 text-[#c7c7c7]">
                                {section.items.map((item) => (
                                    <li key={item}>{item}</li>
                                ))}
                            </ul>
                        </section>
                    ))}
                </div>
            </div>
        </div>
    );
}
