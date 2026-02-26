export default function ChordCard({ block, active, onRemove }) {
    return (
        <div className={`card bg-base-100 shadow-md px-4 py-3 flex flex-row items-center gap-3 ${active ? 'ring-2 ring-primary' : ''}`}>
            <span className="font-mono font-bold">{block.display()}</span>
            <span className="text-xs opacity-60">{block.instrument}</span>
            <button className="btn btn-ghost btn-xs" onClick={onRemove}>✕</button>
        </div>
    );
}
