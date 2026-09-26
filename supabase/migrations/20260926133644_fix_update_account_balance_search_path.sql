-- create_transfer corre con search_path = '' y ese valor rige también para el trigger que dispara:
-- 'accounts' sin calificar fallaba con: relation "accounts" does not exist.
--
-- Dos cambios, y hacen falta los dos:
--   1. Calificar las tablas como public.accounts — arregla el error.
--   2. SET search_path TO '' propio — evita que vuelva a pasar. Sin esto la función sigue
--      heredando el search_path de quien la dispare, así que el próximo caller con un
--      search_path distinto la rompe de nuevo, y el síntoma aparece lejos de la causa.
-- NOW() y el resto de lo que usa esta función viven en pg_catalog, que se busca siempre,
-- así que el search_path vacío no afecta nada más acá.
CREATE OR REPLACE FUNCTION public.update_account_balance()
  RETURNS TRIGGER
  LANGUAGE plpgsql
  SET search_path TO ''
  AS $function$
BEGIN
  -- If INSERT or UPDATE, calculate new balance
  IF (TG_OP = 'INSERT') THEN
    UPDATE public.accounts
    SET current_balance = current_balance + 
      CASE 
        WHEN NEW.type = 'credit' THEN NEW.amount
        WHEN NEW.type = 'debit' THEN -NEW.amount
      END
    WHERE id = NEW.account_id;
    
  ELSIF (TG_OP = 'UPDATE') THEN
    -- Revert previous movement
    UPDATE public.accounts
    SET current_balance = current_balance - 
      CASE 
        WHEN OLD.type = 'credit' THEN OLD.amount
        WHEN OLD.type = 'debit' THEN -OLD.amount
      END
    WHERE id = OLD.account_id;
    
    -- Apply new movement
    UPDATE public.accounts
    SET current_balance = current_balance + 
      CASE 
        WHEN NEW.type = 'credit' THEN NEW.amount
        WHEN NEW.type = 'debit' THEN -NEW.amount
      END
    WHERE id = NEW.account_id;
    
  ELSIF (TG_OP = 'DELETE') THEN
    -- Revert deleted movement
    UPDATE public.accounts
    SET current_balance = current_balance - 
      CASE 
        WHEN OLD.type = 'credit' THEN OLD.amount
        WHEN OLD.type = 'debit' THEN -OLD.amount
      END
    WHERE id = OLD.account_id;
    
    RETURN OLD;
  END IF;
  
  RETURN NEW;
END;
$function$;

