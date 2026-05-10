from mcp.server.fastmcp import FastMCP
from pydantic import BaseModel, Field

# Mock Database
class Empleado(BaseModel):
    id: str
    nombre: str
    puesto: str
    sueldo_base: float
    deducciones: float = 0.0

empleados: dict[str, Empleado] = {
    "EMP001": Empleado(id="EMP001", nombre="Ana", puesto="Gerente", sueldo_base=25000.0),
    "EMP002": Empleado(id="EMP002", nombre="Luis", puesto="Desarrollador", sueldo_base=18000.0),
    "EMP003": Empleado(id="EMP003", nombre="Marta", puesto="Diseñadora", sueldo_base=15000.0),
}

# MCP Server Initialization
mcp = FastMCP("HRSalaryServer")

@mcp.tool()
def get_salary_info(employee_id: str) -> float:
    """Consulta el sueldo base de un empleado.
    
    Args:
        employee_id: El identificador del empleado (e.g. 'EMP001').
    """
    empleado = empleados.get(employee_id.strip().upper())
    if empleado:
        print(f"\n[MCP Tool Executed: get_salary_info('{employee_id}') -> {empleado.sueldo_base}]\n")
        return empleado.sueldo_base
    print(f"\n[MCP Tool Executed: get_salary_info('{employee_id}') -> No encontrado]\n")
    return -1.0

@mcp.tool()
def apply_deductions(amount: float) -> float:
    """Aplica las deducciones de impuestos (resta un 10% fijo) del monto bruto.
    
    Args:
        amount: El monto bruto al cual aplicarle la deducción.
    """
    res = amount * 0.90
    print(f"\n[MCP Tool Executed: apply_deductions({amount}) -> {res}]\n")
    return res

if __name__ == "__main__":
    mcp.run(transport="stdio")
