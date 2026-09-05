CREATE OR REPLACE FUNCTION public.update_account_balance()
  RETURNS TRIGGER
  LANGUAGE plpgsql
  AS $function$
BEGIN
  -- If INSERT or UPDATE, calculate new balance
  IF (TG_OP = 'INSERT') THEN
    UPDATE accounts
    SET current_balance = current_balance + 
      CASE 
        WHEN NEW.type = 'credit' THEN NEW.amount
        WHEN NEW.type = 'debit' THEN -NEW.amount
      END
    WHERE id = NEW.account_id;
    
  ELSIF (TG_OP = 'UPDATE') THEN
    -- Revert previous movement
    UPDATE accounts
    SET current_balance = current_balance - 
      CASE 
        WHEN OLD.type = 'credit' THEN OLD.amount
        WHEN OLD.type = 'debit' THEN -OLD.amount
      END
    WHERE id = OLD.account_id;
    
    -- Apply new movement
    UPDATE accounts
    SET current_balance = current_balance + 
      CASE 
        WHEN NEW.type = 'credit' THEN NEW.amount
        WHEN NEW.type = 'debit' THEN -NEW.amount
      END
    WHERE id = NEW.account_id;
    
  ELSIF (TG_OP = 'DELETE') THEN
    -- Revert deleted movement
    UPDATE accounts
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

GRANT EXECUTE ON FUNCTION "public"."update_account_balance"() TO PUBLIC, "anon", "authenticated", "postgres", "service_role";
