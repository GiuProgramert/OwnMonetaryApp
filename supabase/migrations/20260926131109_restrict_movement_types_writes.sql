-- Cierra el agujero de escritura de movement_types: solo el dueño de la app escribe.
-- La lectura (movement_types_read) NO se toca: ver docs/plans/transfers-implementation.md.

drop policy "movement_types_write" on public.movement_types;

-- En un futuro, sí cambia el UUID se debe cambiar este
create policy "movement_types_insert" on public.movement_types
  for insert to authenticated
  with check ((select auth.uid()) = '<user_id-que-puede-modificar-los-movement_types>');

-- En un futuro, sí cambia el UUID se debe cambiar este
create policy "movement_types_update" on public.movement_types
  for update to authenticated
  using ((select auth.uid()) = '<user_id-que-puede-modificar-los-movement_types>');

-- En un futuro, sí cambia el UUID se debe cambiar este
create policy "movement_types_delete" on public.movement_types
  for delete to authenticated
  using ((select auth.uid()) = '<user_id-que-puede-modificar-los-movement_types>');

-- En un futuro, sí cambia el UUID se debe cambiar este
-- Tipo fijo de las transferencias. El id es contrato con lib/constants.ts (transferMovementTypeId).
insert into public.movement_types (id, name, description, color)
values ('e7f1b48a-be01-48a5-9982-5a4d4025493c', 'Transferencia', 'Traspaso entre cuentas propias', '#6B7280');
