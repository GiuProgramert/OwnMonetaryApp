-- Cuenta principal: la que queda preseleccionada en el filtro de movimientos,
-- en el dashboard y en el alta de un movimiento nuevo.
--
-- Se permiten VARIAS cuentas principales por usuario a propósito: no hay índice
-- único parcial, ni trigger que desmarque las demás. El desempate lo hace la app
-- (lib/accounts/primary.ts): la primera por nombre, porque getAccounts() ordena
-- por name asc. Tampoco hay índice sobre la columna: ninguna query filtra por
-- is_primary, se lee del listado de cuentas que la página ya trae.

alter table public.accounts
  add column is_primary boolean not null default false;

comment on column public.accounts.is_primary is
  'Cuenta preseleccionada en filtros y formularios. Puede haber más de una por usuario; la app usa la primera por nombre.';
