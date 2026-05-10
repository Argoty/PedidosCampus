import json
import asyncio
import os
import sys
from dotenv import load_dotenv

from mirascope import llm
from mcp import ClientSession, StdioServerParameters
from mcp.client.stdio import stdio_client

load_dotenv()
os.environ["GOOGLE_API_KEY"] = os.getenv("GOOGLE_API_KEY", "")

# ── Mirascope Stub Tools ──────────────────────────────────────────────────────

@llm.tool
def get_salary_info(employee_id: str) -> float:
    """Consulta el sueldo base de un empleado.
    
    Args:
        employee_id: El identificador del empleado (e.g. 'EMP001').
    """
    pass

@llm.tool
def apply_deductions(amount: float) -> float:
    """Aplica las deducciones de impuestos (resta un 10% fijo) del monto bruto.
    
    Args:
        amount: El monto bruto al cual aplicarle la deducción.
    """
    pass

# ── Agent ─────────────────────────────────────────────────────────────────────

@llm.call(
    "google/gemini-3.1-pro-preview",
    tools=[get_salary_info, apply_deductions]
)
def hr_agent(query: str, history: list):
    return f"""
    SYSTEM: Eres un asistente virtual de Recursos Humanos. 
    Tu tarea principal es consultar los salarios de los empleados y aplicar las deducciones.
    Para ello, tienes dos herramientas clave provistas a través de MCP: `get_salary_info` y `apply_deductions`.
    Responde siempre de forma educada, amena y muy clara a las preguntas sobre el salario. 
    Si el ID del empleado no existe en la base de datos (retorna -1.0), indícalo.

    MESSAGES: {history}
    USER: {query}
    """

async def process_chat(query: str, history: list) -> tuple[str, list]:
    current_query = query + " \n\n (Analiza cuidadosamente si necesitas herramientas. Llámalas si las necesitas y luego escribe tu respuesta final. SIEMPRE aplica de forma autónoma las herramientas si lo requieres.)"
    
    server_params = StdioServerParameters(
        command="../server/venv/bin/python3", 
        args=["../server/server.py"]
    )
    
    async with stdio_client(server_params) as (read, write):
        async with ClientSession(read, write) as session:
            await session.initialize()
            
            while True:
                response = hr_agent(current_query, history)
                
                if response.tool_calls:
                    for tool_call in response.tool_calls:
                        args_dict = tool_call.args if isinstance(tool_call.args, dict) else json.loads(tool_call.args)
                        
                        print(f"[Client] Evaluando tool_call MCP remoto: {tool_call.name} con {args_dict}")
                        
                        # Ejecutamos la herramienta en el servidor MCP en vez de local
                        mcp_res = await session.call_tool(tool_call.name, arguments=args_dict)
                        
                        # Obtenemos el texto puro del resultado MCP
                        if mcp_res.isError:
                            result_data = f"MCP Error: {mcp_res.content}"
                        else:
                            extracted = " ".join([c.text for c in mcp_res.content if hasattr(c, 'text')])
                            try:
                                result_data = json.loads(extracted)
                            except:
                                result_data = extracted
                        
                        history.append({"role": "model", "parts": [{"text": f"Llamando a {tool_call.name} con {tool_call.args}"}]})
                        history.append({"role": "user", "parts": [{"text": f"System/ToolResult: Resultado de la herramienta MCP {tool_call.name}: {result_data}. Continúa."}]})
                        
                    current_query = "Por favor con los resultados obtenidos del sistema, responde a la pregunta original del usuario."
                    continue
                    
                else:
                    final_content = response.text()
                    history.append({"role": "user", "parts": [{"text": query}]})
                    history.append({"role": "model", "parts": [{"text": final_content}]})
                    return final_content, history
