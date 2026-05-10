from typing import List, Dict

# memory store: key (session_id) string, value (list of dict messages compatible with LLM or mirascope memory)
_session_memory: Dict[str, List[Dict[str, any]]] = {}

def get_history(session_id: str) -> List[Dict[str, any]]:
    if session_id not in _session_memory:
        _session_memory[session_id] = []
    return _session_memory[session_id]

def add_message(session_id: str, role: str, text: str) -> None:
    history = get_history(session_id)
    history.append({"role": role, "parts": [{"text": text}]})

def clear_history(session_id: str) -> None:
    if session_id in _session_memory:
        _session_memory[session_id] = []
