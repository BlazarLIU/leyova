-- 219_remove_dict_items.sql: 彻底移除字典管理与 dict_items 表

DROP TABLE IF EXISTS public.dict_items CASCADE;
DELETE FROM public.role_modules WHERE module_code = 'system_dict';
DELETE FROM public.system_modules WHERE code = 'system_dict';
